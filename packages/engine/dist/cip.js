// Canonical Internal Protocol (spec §3). Vendor-neutral and a superset of what adapters carry.
// Rule 1: anything not modelled yet travels in `vendorExtensions`, untouched.
// Rule 2: an adapter that cannot represent a field throws UnsupportedFeatureError; it never drops it.
// Thrown by an adapter when the target cannot carry a feature, instead of silently dropping it.
export class UnsupportedFeatureError extends Error {
    feature;
    target;
    constructor(feature, target) {
        super(`${target} cannot carry ${feature}`);
        this.name = "UnsupportedFeatureError";
        this.feature = feature;
        this.target = target;
    }
}
//# sourceMappingURL=cip.js.map