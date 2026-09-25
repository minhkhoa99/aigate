import type { Tone } from "../../shared/ui";
import type { Connection, TestStatus } from "./api";

// What a stored test result means to the user (docs/contracts/connections.md, "UI"). Only
// invalid and no_quota are answers about the key; unreachable means the key was not checked.
const PILLS: Record<TestStatus, { tone: Tone; label: string }> = {
  untested: { tone: "muted", label: "Not tested" },
  active: { tone: "healthy", label: "Working" },
  invalid: { tone: "danger", label: "Key rejected" },
  no_quota: { tone: "warning", label: "No quota" },
  unreachable: { tone: "warning", label: "Not checked" },
};

export function statusPill(connection: Pick<Connection, "isActive" | "testStatus">): { tone: Tone; label: string } {
  return connection.isActive ? PILLS[connection.testStatus] : { tone: "muted", label: "Disabled" };
}

export function needsAttention(connection: Pick<Connection, "isActive" | "testStatus">): boolean {
  return !connection.isActive || connection.testStatus !== "active";
}

export function describeTest(connection: Pick<Connection, "providerName" | "testStatus" | "lastError" | "lastErrorCode">): {
  tone: "success" | "error"; message: string; code?: string;
} {
  const provider = connection.providerName;
  switch (connection.testStatus) {
    case "active": return { tone: "success", message: `${provider} accepted the key.` };
    case "invalid": return { tone: "error", code: "AUTH_ERROR", message: `${provider} rejected the key. Check it, then use Replace key.` };
    case "no_quota": return { tone: "error", code: "QUOTA_EXHAUSTED", message: `The key works, but the ${provider} account has no quota or credit left.` };
    case "unreachable": return {
      tone: "error", code: connection.lastErrorCode ?? "PROVIDER_UNAVAILABLE",
      message: `Could not check the key: ${connection.lastError ?? `${provider} did not answer`}. The key was not judged; try again later.`,
    };
    case "untested": return { tone: "error", message: "The key changed while it was being tested. Test it again." };
  }
}
