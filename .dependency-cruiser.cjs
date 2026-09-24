module.exports = {
  forbidden: [{
    name: "domain-no-vendor-sdk",
    severity: "error",
    from: { path: "^(apps/[^/]+/src/modules/[^/]+/domain/|tools/lint/fixtures/domain/)" },
    to: { dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer"] },
  }],
  options: { doNotFollow: { path: "node_modules" } },
};
