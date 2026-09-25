// A request is local only when the socket, Host, and any Origin all name this machine
// (docs/contracts/identity-apikeys.md). Host and Origin stop DNS rebinding: a hostile page can
// resolve its own domain to 127.0.0.1, but it cannot make the browser send a loopback Host.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface RequestOrigin {
  ip: string;
  host: string | undefined;
  origin: string | undefined;
}

function isLoopbackIp(ip: string): boolean {
  return ip === "::1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.");
}

function hostnameOf(host: string): string {
  // "[::1]:20200" keeps its brackets; "localhost:20200" drops the port.
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":", 1)[0];
}

export function isLocalRequest({ ip, host, origin }: RequestOrigin): boolean {
  if (!isLoopbackIp(ip) || !host || !LOCAL_HOSTNAMES.has(hostnameOf(host.toLowerCase()))) return false;
  if (origin === undefined) return true;
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname.toLowerCase().replace(/^::1$/, "[::1]"));
  } catch {
    return false;
  }
}
