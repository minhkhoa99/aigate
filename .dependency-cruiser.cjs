module.exports = {
  forbidden: [{
    name: "domain-no-vendor-sdk",
    severity: "error",
    from: { path: "^(apps/[^/]+/src/modules/[^/]+/domain/|tools/lint/fixtures/domain/)" },
    to: { dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer"] },
  }, {
    // Spec §2: the provider engine is pure TypeScript with zero framework (or any npm) imports.
    name: "engine-framework-free",
    severity: "error",
    from: { path: "^(packages/engine/src/|tools/lint/fixtures/engine/)" },
    to: { dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer"] },
  }],
  options: { doNotFollow: { path: "node_modules" } },
};
