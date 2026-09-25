const isMember = (node, object, property) =>
  node?.type === "MemberExpression" && !node.computed && node.object.name === object && node.property.name === property;

const isTimeoutCall = (node) => node?.type === "CallExpression" && isMember(node.callee, "AbortSignal", "timeout");
// signal: AbortSignal.timeout(n), or AbortSignal.any([...]) that includes one (the shared request signal plus a deadline).
const isBoundedSignal = (node) => isTimeoutCall(node) || (node?.type === "CallExpression" && isMember(node.callee, "AbortSignal", "any") &&
  node.arguments[0]?.type === "ArrayExpression" && node.arguments[0].elements.some(isTimeoutCall));
const hasTimeoutSignal = (node) => node?.type === "ObjectExpression" && node.properties.some((entry) =>
  entry.type === "Property" && entry.key.name === "signal" && isBoundedSignal(entry.value));
const isFetch = (callee) => callee.name === "fetch" || isMember(callee, "globalThis", "fetch");
const FUNCTION_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
// Walks a subtree without entering nested functions, which run on their own schedule.
function findInScope(node, predicate) {
  if (!node || typeof node.type !== "string") return false;
  if (predicate(node)) return true;
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child.type === "string" && !FUNCTION_TYPES.has(child.type) && findInScope(child, predicate)) return true;
    }
  }
  return false;
}
const isRetryShapedTry = (node) => node.type === "TryStatement" && node.handler !== null && findInScope(node.block, (n) => n.type === "AwaitExpression");

export const aigateRules = {
  "bounded-promise-all": {
    meta: { type: "problem", messages: { unbounded: "Promise.all needs a statically bounded array; use a concurrency-limited helper for dynamic collections." } },
    create(context) {
      return {
        CallExpression(node) {
          const argument = node.arguments[0];
          if (isMember(node.callee, "Promise", "all") &&
            (argument?.type !== "ArrayExpression" || argument.elements.some((element) => element?.type === "SpreadElement"))) {
            context.report({ node, messageId: "unbounded" });
          }
        },
      };
    },
  },
  "fetch-timeout": {
    meta: { type: "problem", messages: { timeout: "fetch must use AbortSignal.timeout(...) or a bounded request helper." } },
    create(context) {
      return {
        CallExpression(node) {
          if (isFetch(node.callee) && !hasTimeoutSignal(node.arguments[1])) {
            context.report({ node, messageId: "timeout" });
          }
        },
      };
    },
  },
  // Spec §2/§4.2: outbound HTTP from the server and engine goes through HttpTransportPort only.
  "fetch-through-transport": {
    meta: { type: "problem", messages: { transport: "Send outbound HTTP through HttpTransportPort (modules/transport), not fetch directly." } },
    create(context) {
      return { CallExpression(node) { if (isFetch(node.callee)) context.report({ node, messageId: "transport" }); } };
    },
  },
  // Spec §11.2 "Retry không trần — chỉ cho phép qua helper duy nhất": a loop around an awaited try/catch is a
  // hand-written retry. Use withRetry() from @aigate/engine, which bounds attempts, backoff, and cancellation.
  "retry-through-helper": {
    meta: { type: "problem", messages: { retry: "Retry through withRetry() from @aigate/engine instead of a loop around try/await/catch." } },
    create(context) {
      const check = (node) => { if (findInScope(node.body, isRetryShapedTry)) context.report({ node, messageId: "retry" }); };
      return { ForStatement: check, ForInStatement: check, ForOfStatement: check, WhileStatement: check, DoWhileStatement: check };
    },
  },
  "no-secret-logging": {
    meta: { type: "problem", messages: { secret: "Do not log keys, tokens, passwords, or secrets." } },
    create(context) {
      const isSecret = (node) => {
        if (!node) return false;
        if (node.type === "Identifier") return /(?:^|_)(?:key|token|password|secret|credential)$|(?:Key|Token|Password|Secret|Credential)$/.test(node.name);
        if (node.type === "MemberExpression") return isSecret(node.property) || isSecret(node.object);
        if (node.type === "TemplateLiteral") return node.expressions.some(isSecret);
        if (node.type === "ObjectExpression") return node.properties.some((entry) => isSecret(entry.key) || isSecret(entry.value));
        return false;
      };
      return {
        CallExpression(node) {
          const callee = node.callee;
          if (callee.type !== "MemberExpression" || !/^(?:log|info|warn|error|debug)$/.test(callee.property.name)) return;
          if (callee.object.name !== "console" && callee.object.name !== "logger") return;
          if (node.arguments.some(isSecret)) context.report({ node, messageId: "secret" });
        },
      };
    },
  },
  "no-type-assertion": {
    meta: { type: "problem", messages: { assertion: "Avoid type assertions; validate or narrow the value instead." } },
    create(context) {
      return {
        TSAsExpression(node) {
          if (node.typeAnnotation.type === "TSTypeReference" && node.typeAnnotation.typeName.name === "const") return;
          context.report({ node, messageId: "assertion" });
        },
        TSTypeAssertion(node) { context.report({ node, messageId: "assertion" }); },
      };
    },
  },
  "bounded-query": {
    meta: { type: "problem", messages: {
      selectStar: "Select explicit columns instead of SELECT *.",
      noLimit: "SELECT queries in repositories need a LIMIT (Drizzle: .limit() or .get()).",
    } },
    create(context) {
      // Drizzle builder: db.select(...).from(t)... must name its columns and end in .limit() or .get().
      function checkDrizzleSelect(node) {
        const select = node.callee.object;
        if (select?.type !== "CallExpression" || !["select", "selectDistinct"].includes(select.callee.property?.name)) return;
        if (select.arguments.length === 0) context.report({ node: select, messageId: "selectStar" });
        const methods = [];
        let current = node;
        while (current.parent?.type === "MemberExpression" && current.parent.object === current && current.parent.parent?.type === "CallExpression") {
          methods.push(current.parent.property.name);
          current = current.parent.parent;
        }
        if (!methods.includes("limit") && !methods.includes("get")) context.report({ node, messageId: "noLimit" });
      }
      return {
        CallExpression(node) {
          if (node.callee.property?.name === "from") return checkDrizzleSelect(node);
          if (node.callee.name !== "query" && node.callee.property?.name !== "query") return;
          const argument = node.arguments[0];
          const sql = argument?.type === "Literal" ? argument.value
            : argument?.type === "TemplateLiteral" ? argument.quasis.map((part) => part.value.raw).join(" ") : null;
          if (typeof sql !== "string" || !/^\s*SELECT\b/i.test(sql)) return;
          if (/\bSELECT\s+\*/i.test(sql)) context.report({ node: argument, messageId: "selectStar" });
          if (!/\bLIMIT\b/i.test(sql)) context.report({ node: argument, messageId: "noLimit" });
        },
      };
    },
  },
};
