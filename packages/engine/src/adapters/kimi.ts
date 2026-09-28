import type { Credential, HttpRequest, HttpTransportPort } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";
import { AnthropicAdapter } from "./anthropic.js";

const VERSION = "0.1.0";
const deviceModel = (): string => {
  const platform = typeof process !== "undefined" ? process.platform : "unknown";
  const arch = typeof process !== "undefined" ? process.arch : "unknown";
  return platform === "darwin" ? `macOS ${arch}` : platform === "win32" ? `Windows ${arch}` : platform === "linux" ? `Linux ${arch}` : `${platform} ${arch}`;
};

export class KimiAdapter extends AnthropicAdapter {
  constructor(provider: ProviderDescriptor, transport: HttpTransportPort) { super(provider, transport); }

  protected override request(method: HttpRequest["method"], url: string, credential: Credential, timeoutMs: number): HttpRequest {
    const base = super.request(method, url, credential, timeoutMs);
    const deviceId = credential.providerData?.deviceId ?? credential.sessionId ?? `kimi-${Date.now()}`;
    return { ...base, headers: {
      ...base.headers, "X-Msh-Platform": "9router", "X-Msh-Version": VERSION, "X-Msh-Device-Name": "unknown", "X-Msh-Device-Model": deviceModel(),
      "X-Msh-Device-Id": deviceId,
    } };
  }
}
