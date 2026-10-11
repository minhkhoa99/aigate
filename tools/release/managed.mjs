import { dirname, join, resolve } from "node:path";
import { verifyRelease } from "./release.mjs";
import { createManagedInstall } from "../../apps/server/dist/modules/settings/infrastructure/managed-release.js";

const [, , command, manifestPath, keyPath, root] = process.argv;
if (command !== "install" || !manifestPath || !keyPath || !root || process.argv.length !== 6) {
  console.error("Usage: managed.mjs install <manifest.json> <public-key.pem> <new-install-root>");
  process.exitCode = 2;
} else {
  try {
    const manifestFile = resolve(manifestPath);
    const verified = await verifyRelease(manifestFile, resolve(keyPath));
    const archive = join(dirname(manifestFile), verified.artifact);
    const controller = new AbortController();
    await createManagedInstall(root, verified, archive, controller.signal);
    console.log(JSON.stringify({ installed: true, version: verified.version, launcher: join(resolve(root), "launcher.mjs") }));
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
