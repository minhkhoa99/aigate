import { Injectable } from "@nestjs/common";
import { builtinRegistry, CATALOG, mediaService } from "@aigate/engine";
import { ApiKeysRepository } from "../../apikeys/infrastructure/api-keys.repo.js";
import { ConnectionsRepository } from "../../connections/infrastructure/connections.repo.js";
import { ProviderNodesRepository } from "../../connections/infrastructure/provider-nodes.repo.js";

export interface Names {
  provider(id: string | null): string | null;
  connection(id: string | null): string | null;
  key(id: string | null): string | null;
}

// Display names for usage rows (each list is bounded by its repository); an id that no longer exists is shown as it is.
@Injectable()
export class DisplayNames {
  constructor(
    private readonly connections: ConnectionsRepository,
    private readonly nodes: ProviderNodesRepository,
    private readonly keys: ApiKeysRepository,
  ) {}

  async load(): Promise<Names> {
    const nodes = new Map((await this.nodes.list()).map((node) => [node.id, node.name]));
    const connections = new Map((await this.connections.list()).map((connection) => [connection.id, connection.name]));
    const keys = new Map((await this.keys.list()).map((key) => [key.id, key.name]));
    return {
      provider: (id) => (id === null ? null : builtinRegistry.provider(id)?.name ?? mediaService(id)?.name ?? CATALOG.find((entry) => entry.id === id)?.name ?? nodes.get(id) ?? id),
      connection: (id) => (id === null ? null : connections.get(id) ?? id),
      key: (id) => (id === null ? null : keys.get(id) ?? id),
    };
  }
}
