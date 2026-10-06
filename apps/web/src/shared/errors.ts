import { ApiError } from "./api.ts";
import { translate, type Language, type MessageKey, type Params } from "./i18n.ts";

export type Problem = { code: string; message: string };
// Only app-owned advice is translated. Raw provider/validation detail remains verbatim.
const PASSTHROUGH = new Set(["NOT_FOUND", "CONFLICT", "PROVIDER_UNAVAILABLE", "PROVIDER_NOT_SUPPORTED", "ALREADY_CONNECTED",
  "NO_ACTIVE_CONNECTION", "VOICE_PREVIEW_FAILED", "TUNNEL_SECURITY_REQUIRED", "TUNNEL_ROUTE_CONFLICT"]);

export function toProblem(error: unknown, language: Language = "en"): Problem {
  const t = (key: MessageKey, params?: Params) => translate(language, key, params);
  if (!(error instanceof ApiError)) return { code: "UNEXPECTED", message: t("errors.UNEXPECTED") };
  const { code, body } = error;
  const detail = typeof body.message === "string" ? body.message : undefined;
  if (detail && PASSTHROUGH.has(code)) return { code, message: detail };
  if (code === "INVALID_REQUEST") return { code, message: error.message };
  if (detail !== undefined && code === "OAUTH_FAILED") return { code, message: t("errors.OAUTH_DETAIL", { message: detail }) };
  if (detail !== undefined && code === "MODELS_FETCH_FAILED") return { code, message: t("errors.MODELS_DETAIL", { message: detail }) };
  if (detail !== undefined && code === "VOICES_FETCH_FAILED") return { code, message: t("errors.VOICES_DETAIL", { message: detail }) };
  const n = (value: number) => language === "en" ? String(value) : new Intl.NumberFormat("vi-VN").format(value);
  if (code === "TIMEOUT") return { code, message: t("errors.TIMEOUT", { seconds: n(typeof body.timeoutSeconds === "number" ? body.timeoutSeconds : 10) }) };
  if (code === "INVALID_CREDENTIALS" && typeof body.remainingBeforeLock === "number") return { code, message: t("errors.INVALID_CREDENTIALS_COUNT", { count: n(body.remainingBeforeLock) }) };
  if (code === "RATE_LIMITED" && typeof body.retryAfter === "number") return { code, message: t("errors.RATE_LIMITED_TIME", { seconds: n(body.retryAfter) }) };
  // Pure lookup guards own keys; unknown codes and empty raw detail retain the original HTTP fallback.
  const key = `errors.${code}` as MessageKey;
  const owned = detail === "" && PASSTHROUGH.has(code) ? key : t(key);
  if (owned !== key) return { code, message: owned };
  if (error.status >= 500) return { code, message: t("errors.HTTP_SERVER", { status: error.status }) };
  return { code, message: error.message || t("errors.HTTP_FAILURE", { status: error.status }) };
}
