const isMember = (node, object, property) =>
  node?.type === "MemberExpression" && !node.computed && node.object.name === object && node.property.name === property;

const hasTimeoutSignal = (node) => node?.type === "ObjectExpression" && node.properties.some((entry) =>
  entry.type === "Property" && entry.key.name === "signal" &&
  entry.value.type === "CallExpression" && isMember(entry.value.callee, "AbortSignal", "timeout"));

export const aigateRules = {
  "bounded-promise-all": {
    meta: { type: "problem", messages: { unbounded: "Promise.all needs a statically bounded array; use a concurrency-limited helper for dynamic collections." } },
    create(context) {
      return {
        CallExpression(node) {
          if (isMember(node.callee, "Promise", "all") && node.arguments[0]?.type !== "ArrayExpression") {
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
          if (node.callee.name === "fetch" && !hasTimeoutSignal(node.arguments[1])) {
            context.report({ node, messageId: "timeout" });
          }
        },
      };
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
      noLimit: "SELECT queries in repositories need a LIMIT.",
    } },
    create(context) {
      return {
        CallExpression(node) {
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
