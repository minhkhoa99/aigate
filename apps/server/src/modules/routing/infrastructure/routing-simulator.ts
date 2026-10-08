import { Injectable } from "@nestjs/common";
import { assertModelSupports, builtinRegistry, detectRequiredCapabilities, EngineError, resolveCapabilities, toOpenAIError, type CanonicalRequest } from "@aigate/engine";
import { chooseAccount } from "../../connections/domain/account-selection.js";
import { ConnectionsRepository, type BoundedRows, type RoutingAccount, type RoutingLock } from "../../connections/infrastructure/connections.repo.js";
import { isReservedPrefix, ProviderNodesRepository, type RoutingNode } from "../../connections/infrastructure/provider-nodes.repo.js";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { modelFit, reorderByCapabilities, trimHistory, widen, type Widening } from "../domain/capacity.js";
import { MAX_COMBO_DEPTH, memberFailover, panelRequest, type Combo } from "../domain/combo.js";
import { resolveModelTarget } from "../domain/model-resolution.js";
import { SIMULATION_NODES, SIMULATION_PROVIDERS, type DecisionNode, type SimulationInput, type SimulationResult, type SimulationWarning } from "../domain/routing-simulator.js";
import { applyTokenSaver, headroomInput } from "../domain/token-saver.js";
import { CapacityPoolsRepository } from "./capacity-pools.repo.js";
import { CombosRepository } from "./combos.repo.js";

type Failure = { status: number; code: string; message: string };
type Branch = { outcome: "candidate" | "blocked" | "conditional" | "unknown"; failure?: Failure };
const unknown = (): Branch => ({ outcome: "unknown" });

// Concrete local inspector. No transport, secret cipher, refresher, proxy or recorder is injected.
@Injectable()
export class RoutingSimulator {
  constructor(private readonly settings: SettingsRepository, private readonly combos: CombosRepository,
    private readonly pools: CapacityPoolsRepository, private readonly connections: ConnectionsRepository,
    private readonly providerNodes: ProviderNodesRepository) {}

  async explain(input: SimulationInput, signal: AbortSignal, observedAt = new Date()): Promise<SimulationResult> {
    signal.throwIfAborted();
    const [settings, combos, pools, activity] = await Promise.all([
      this.settings.get(), this.combos.list(), this.pools.list(), this.connections.routingActivity(),
    ]);
    signal.throwIfAborted();
    for (const provider of builtinRegistry.providers) if (provider.auth.kind === "none") activity.providers.add(provider.id);
    const warnings = new Set<SimulationWarning>(["snapshot-not-reserved", "provider-preparation-unchecked"]);
    if (settings.tokenSaverEnabled && !input.tokenSaverOptOut) {
      if (settings.headroomEnabled && headroomInput(input.request)) warnings.add("headroom-skipped");
      if (settings.pxpipeEnabled) warnings.add("pxpipe-skipped");
    }
    const request = await applyTokenSaver(input.request, { ...settings, headroomEnabled: false }, input.tokenSaverOptOut,
      async () => { throw new Error("Simulation never executes Headroom"); }, signal);
    signal.throwIfAborted();
    const nodes: DecisionNode[] = [];
    const byName = new Map(combos.map(combo => [combo.name, combo]));
    const accounts = new Map<string, BoundedRows<RoutingAccount>>();
    const locks = new Map<string, BoundedRows<RoutingLock>>();
    const prefixes = new Map<string, RoutingNode | undefined>();
    const inspectedProviders = new Set<string>();
    let truncated = activity.truncated;
    let halted = false;

    const append = (node: Omit<DecisionNode, "id">): number | undefined => {
      signal.throwIfAborted();
      if (halted || nodes.length >= SIMULATION_NODES) { truncated = true; halted = true; return undefined; }
      const id = nodes.length;
      nodes.push({ ...node, id, ...(node.model !== undefined ? { model: node.model.slice(0, 256) } : {}),
        ...(node.provider !== undefined ? { provider: node.provider.slice(0, 256) } : {}),
        ...(node.connectionId !== undefined ? { connectionId: node.connectionId.slice(0, 256) } : {}) });
      return id;
    };
    const reject = (id: number, failure: Failure): Branch => {
      nodes[id].status = "blocked"; nodes[id].reason = "route-rejected"; nodes[id].errorCode = failure.code;
      return { outcome: "blocked", failure };
    };
    const limited = (id: number): Branch => {
      truncated = true; nodes[id].status = "unknown"; nodes[id].reason = "inspection-limit";
      return unknown();
    };
    const inspectModel = async (req: CanonicalRequest, parentId: number, conditional: boolean, order?: number, trimmedMessages?: number): Promise<Branch> => {
      const id = append({ parentId, kind: "model", status: conditional ? "conditional" : "candidate", reason: "model-resolved", model: req.model, order, trimmedMessages });
      if (id === undefined) return unknown();
      const slash = req.model.indexOf("/"), prefix = slash > 0 ? req.model.slice(0, slash) : undefined;
      let providerId = prefix === undefined ? undefined : builtinRegistry.provider(prefix)?.id;
      if (prefix !== undefined && !providerId) {
        const status = builtinRegistry.status(prefix);
        if (status && !status.connectable) return reject(id, { status: 400, code: "provider_not_supported", message: "Provider cannot be connected yet" });
        if (!isReservedPrefix(prefix)) {
          if (!prefixes.has(prefix)) {
            const metadata = await this.providerNodes.routingNodeByPrefix(prefix);
            signal.throwIfAborted(); prefixes.set(prefix, metadata);
          }
          providerId = prefixes.get(prefix)?.id;
        }
      }
      const target = resolveModelTarget(req.model, providerId, activity.providers);
      if (!target.ok) {
        if (activity.truncated && target.code === "no_active_connection") return limited(id);
        return reject(id, target);
      }
      providerId = target.providerId;
      nodes[id].provider = providerId.slice(0, 256);
      if (!inspectedProviders.has(providerId) && inspectedProviders.size >= SIMULATION_PROVIDERS) { halted = true; return limited(id); }
      inspectedProviders.add(providerId);
      const model = builtinRegistry.model(providerId, target.catalogModelId);
      const upstream = { ...req, model: target.catalogModelId };
      try { assertModelSupports(upstream, providerId, model, target.catalogModelId); }
      catch (error) {
        if (!(error instanceof EngineError) || (error.code !== "MODEL_UNAVAILABLE" && error.code !== "INVALID_REQUEST")) throw error;
        const available = resolveCapabilities(model);
        nodes[id].missingCapabilities = [...detectRequiredCapabilities(upstream)].filter(capability => !available[capability]);
        const classified = toOpenAIError(error);
        return reject(id, { status: classified.status, code: classified.body.error.code, message: classified.body.error.message });
      }
      if (builtinRegistry.provider(providerId)?.auth.kind === "none") {
        append({ parentId: id, kind: "account", status: conditional ? "conditional" : "candidate", reason: "keyless-provider", provider: providerId });
        return { outcome: "candidate" };
      }
      warnings.add("credentials-unchecked");
      if (!accounts.has(providerId)) {
        const rows = await this.connections.routingAccounts(providerId);
        signal.throwIfAborted(); accounts.set(providerId, rows);
      }
      const accountRows = accounts.get(providerId);
      if (!accountRows) throw new Error("Missing inspection accounts");
      const lockKey = JSON.stringify([providerId, target.catalogModelId]);
      if (!locks.has(lockKey)) {
        const rows = await this.connections.routingLocks(providerId, target.catalogModelId, observedAt);
        signal.throwIfAborted(); locks.set(lockKey, rows);
      }
      const lockRows = locks.get(lockKey);
      if (!lockRows) throw new Error("Missing inspection locks");
      if (accountRows.truncated || lockRows.truncated) return limited(id);
      const blocked = new Map<string, Date>();
      for (const lock of lockRows.rows) {
        const prior = blocked.get(lock.connectionId);
        if (!prior || lock.until > prior) blocked.set(lock.connectionId, lock.until);
      }
      const active = accountRows.rows.filter(row => row.isActive);
      const choice = chooseAccount(active.filter(row => !blocked.has(row.id)), settings.fallbackStrategy);
      for (const row of accountRows.rows) {
        const until = blocked.get(row.id);
        const selected = row.id === choice?.account.id;
        append({ parentId: id, kind: "account", provider: providerId, connectionId: row.id, priority: row.priority,
          strategy: settings.fallbackStrategy, ...(until ? { lockUntil: until.toISOString() } : {}),
          status: !row.isActive || until ? "blocked" : selected && !conditional ? "candidate" : "conditional",
          reason: !row.isActive ? "account-disabled" : until ? "account-locked" : selected ? "account-selected" : "account-fallback" });
        if (halted) return unknown();
      }
      if (choice) {
        if (active.filter(row => !blocked.has(row.id)).length > 1) warnings.add("conditional-fallback");
        return { outcome: "candidate" };
      }
      return reject(id, { status: active.length ? 503 : 404, code: active.length ? "provider_unavailable" : "no_active_connection", message: "No eligible provider account remained" });
    };

    const chain = async (req: CanonicalRequest, members: readonly string[], widened: Widening | undefined,
      parentId: number, depth: number, conditional: boolean): Promise<Branch> => {
      let first: Branch | undefined;
      let last: Branch = { outcome: "blocked" };
      for (const [order, model] of members.entries()) {
        signal.throwIfAborted();
        if (halted) return unknown();
        const trimmed = widened?.pool.includes(model) ? trimHistory(req, modelFit(model).contextWindow) : req;
        const branch = await visit({ ...trimmed, model }, parentId, depth, conditional || first !== undefined, order + 1,
          req.messages.length - trimmed.messages.length);
        if (branch.outcome === "unknown") return branch;
        if (branch.outcome !== "blocked") first ??= branch;
        if (branch.failure && memberFailover(branch.failure.status, branch.failure.message) === undefined) return first ?? branch;
        last = branch;
      }
      if (first) return first;
      if (last.failure?.code === "no_active_connection") return { outcome: "blocked", failure: { status: 503, code: "provider_unavailable", message: "No eligible member remained" } };
      return last;
    };
    const fusion = async (req: CanonicalRequest, combo: Combo, parentId: number, depth: number): Promise<Branch> => {
      warnings.add("conditional-fusion");
      nodes[parentId].fusion = { minPanel: Math.min(Math.max(2, combo.minPanel), combo.models.length),
        stragglerGraceMs: combo.stragglerGraceMs, panelTimeoutMs: combo.panelTimeoutMs, concurrency: 4 };
      const panel = panelRequest(req);
      for (const [order, model] of combo.models.entries()) {
        await visit({ ...panel, model }, parentId, depth, true, order + 1);
        if (halted) return unknown();
      }
      const judgeId = append({ parentId, kind: "judge", status: "conditional", reason: "fusion-judge", model: combo.judgeModel ?? combo.models[0] });
      if (judgeId === undefined) return unknown();
      await visit({ ...req, model: combo.judgeModel ?? combo.models[0] }, judgeId, depth, true);
      return { outcome: "conditional" };
    };
    const visit = async (req: CanonicalRequest, parentId: number, depth: number, conditional: boolean,
      order?: number, trimmedMessages?: number): Promise<Branch> => {
      signal.throwIfAborted();
      if (halted) return unknown();
      const combo = req.model.includes("/") ? undefined : byName.get(req.model);
      if (combo) {
        const id = append({ parentId, kind: "combo", model: combo.name, status: conditional || combo.strategy === "fusion" ? "conditional" : "candidate",
          reason: combo.strategy === "fusion" ? combo.models.length === 1 ? "fusion-single-member" : "fusion-panel" : combo.strategy === "round-robin" ? "combo-round-robin" : "combo-fallback", strategy: combo.strategy, order });
        if (id === undefined) return unknown();
        if (depth >= MAX_COMBO_DEPTH) return reject(id, { status: 400, code: "combo_too_deep", message: "Combo depth exceeded" });
        let result: Branch;
        if (combo.strategy === "fusion") {
          result = combo.models.length === 1 ? await visit({ ...req, model: combo.models[0] }, id, depth + 1, conditional)
            : await fusion(req, combo, id, depth + 1);
        } else {
          warnings.add("conditional-fallback");
          const required = detectRequiredCapabilities(req), widened = widen(combo.models, required, pools);
          const ordered = combo.strategy === "round-robin" ? this.combos.peekOrder(combo, settings.comboStickyLimit) : combo.models;
          result = await chain(req, reorderByCapabilities([...(widened?.pool ?? []), ...ordered], required), widened, id, depth + 1, conditional);
        }
        if (result.failure) nodes[id].errorCode = result.failure.code;
        nodes[id].status = result.outcome === "blocked" ? "blocked" : result.outcome === "unknown" ? "unknown" : conditional || result.outcome === "conditional" ? "conditional" : "candidate";
        return result;
      }
      const widened = depth === 0 ? widen([req.model], detectRequiredCapabilities(req), pools) : undefined;
      if (!widened) return inspectModel(req, parentId, conditional, order, trimmedMessages);
      const id = append({ parentId, kind: "capacity", status: conditional ? "conditional" : "candidate", reason: "capacity-prepended", model: req.model,
        strategy: widened.rotate ? "round-robin" : "fallback" });
      if (id === undefined) return unknown();
      warnings.add("conditional-fallback");
      const ordered = widened.rotate ? this.pools.peekOrder(widened.rotate, widened.pool) : widened.pool;
      const result = await chain(req, [...ordered, req.model], widened, id, 1, conditional);
      nodes[id].status = result.outcome === "blocked" ? "blocked" : result.outcome === "unknown" ? "unknown" : conditional ? "conditional" : "candidate";
      return result;
    };
    const root = append({ parentId: null, kind: "request", status: "candidate", reason: "input-accepted", model: request.model });
    if (root === undefined) throw new Error("Inspection root could not be created");
    const result = await visit(request, root, 0, false);
    signal.throwIfAborted();
    if (truncated) warnings.add("inspection-truncated");
    nodes[root].status = truncated ? "unknown" : result.outcome === "blocked" ? "blocked" : result.outcome === "conditional" ? "conditional" : "candidate";
    if (result.failure) nodes[root].errorCode = result.failure.code;
    return { observedAt: observedAt.toISOString(), outcome: truncated || result.outcome === "unknown" ? "inconclusive" : result.outcome,
      requiredCapabilities: [...detectRequiredCapabilities(request)].sort(), nodes, warnings: [...warnings], truncated };
  }
}
