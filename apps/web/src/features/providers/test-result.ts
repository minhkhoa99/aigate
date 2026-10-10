import type { Tone } from "../../shared/ui";
import type { Message, MessageKey, Params } from "../../shared/i18n";
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
export const STATUS_KEYS = {
  untested: "providers.statusNotTested",
  active: "providers.statusWorking",
  invalid: "providers.statusRejected",
  no_quota: "providers.statusNoQuota",
  unreachable: "providers.statusNotChecked",
} as const satisfies Record<TestStatus, MessageKey>;
type Translate = (key: MessageKey, params?: Params) => string;

export function testNotice(connection: Pick<Connection, "providerName" | "testStatus" | "lastError" | "lastErrorCode">): {
  tone: "success" | "error"; code?: string; localized: Message;
} {
  const { tone, code } = describeTest(connection);
  const provider = connection.providerName;
  let localized: Message;
  switch (connection.testStatus) {
    case "active": localized = { key: "providers.testAccepted", params: { provider } }; break;
    case "invalid": localized = connection.lastError?.includes("Check it in AIGate: Gateway → Endpoint & Keys.")
      ? { key: "providers.testSelfReference", params: { provider } }
      : connection.lastError ? { key: "providers.testRejected", params: { detail: connection.lastError } }
        : { key: "providers.testRejectedDefault", params: { provider } }; break;
    case "no_quota": localized = { key: "providers.testNoQuota", params: { provider } }; break;
    case "unreachable": localized = connection.lastError
      ? { key: "providers.testUnreachable", params: { detail: connection.lastError } }
      : { key: "providers.testUnreachableDefault", params: { provider } }; break;
    case "untested": localized = { key: "providers.testUntested" }; break;
  }
  return { tone, ...(code ? { code } : {}), localized };
}

export function statusPill(connection: Pick<Connection, "isActive" | "testStatus">): { tone: Tone; label: string } {
  return connection.isActive ? PILLS[connection.testStatus] : { tone: "muted", label: "Disabled" };
}

export function needsAttention(connection: Pick<Connection, "isActive" | "testStatus">): boolean {
  return !connection.isActive || connection.testStatus !== "active";
}

export function describeTest(connection: Pick<Connection, "providerName" | "testStatus" | "lastError" | "lastErrorCode">, translate?: Translate): {
  tone: "success" | "error"; message: string; code?: string;
} {
  const provider = connection.providerName;
  switch (connection.testStatus) {
    case "active": return { tone: "success", message: translate?.("providers.testAccepted", { provider }) ?? `${provider} accepted the key.` };
    case "invalid": return {
      tone: "error", code: "AUTH_ERROR",
      message: connection.lastError?.includes("Check it in AIGate: Gateway → Endpoint & Keys.")
         ? translate?.("providers.testSelfReference", { provider }) ?? `${provider} points back to AIGate. Edit its Base URL to the upstream provider API, then test again.`
         : translate?.("providers.testRejected", { detail: connection.lastError ?? (translate?.("providers.testDefaultRejected", { provider }) ?? `${provider} rejected authentication.`) }) ?? `${connection.lastError ?? `${provider} rejected authentication.`} Check the provider endpoint and key.`,
    };
    case "no_quota": return { tone: "error", code: "QUOTA_EXHAUSTED", message: translate?.("providers.testNoQuota", { provider }) ?? `The key works, but the ${provider} account has no quota or credit left.` };
    case "unreachable": return {
      tone: "error", code: connection.lastErrorCode ?? "PROVIDER_UNAVAILABLE",
       message: translate?.("providers.testUnreachable", { detail: connection.lastError ?? (translate?.("providers.testDefaultUnreachable", { provider }) ?? `${provider} did not answer`) }) ?? `Could not check the key: ${connection.lastError ?? `${provider} did not answer`}. The key was not judged; try again later.`,
    };
    case "untested": return { tone: "error", message: translate?.("providers.testUntested") ?? "The key changed while it was being tested. Test it again." };
  }
}
