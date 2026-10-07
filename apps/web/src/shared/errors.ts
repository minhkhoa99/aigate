import { ApiError } from "./api.ts";
import { isMessageKey, translate, type Language, type MessageKey, type Params } from "./i18n.ts";

export type Problem = { code: string; message: string };
// Only app-owned advice is translated. Raw provider/validation detail remains verbatim.
const PASSTHROUGH = new Set(["NOT_FOUND", "CONFLICT", "PROVIDER_UNAVAILABLE", "PROVIDER_NOT_SUPPORTED", "ALREADY_CONNECTED",
  "NO_ACTIVE_CONNECTION", "VOICE_PREVIEW_FAILED", "TUNNEL_SECURITY_REQUIRED", "TUNNEL_ROUTE_CONFLICT"]);

export function toProblem(error: unknown, language: Language = "en"): Problem {
  const t = (key: MessageKey, params?: Params) => translate(language, key, params);
  if (!(error instanceof ApiError)) return { code: "UNEXPECTED", message: t("errorAdvice.UNEXPECTED") };
  const { code, body } = error;
  const detail = typeof body.message === "string" ? body.message : undefined;
  if (detail && PASSTHROUGH.has(code)) return { code, message: detail };
  if (code === "INVALID_REQUEST") return { code, message: error.message };
  if (detail !== undefined && code === "OAUTH_FAILED") return { code, message: t("errorAdvice.OAUTH_DETAIL", { message: detail }) };
  if (detail !== undefined && code === "MODELS_FETCH_FAILED") return { code, message: t("errorAdvice.MODELS_DETAIL", { message: detail }) };
  if (detail !== undefined && code === "VOICES_FETCH_FAILED") return { code, message: t("errorAdvice.VOICES_DETAIL", { message: detail }) };
  const n = (value: number) => language === "en" ? String(value) : new Intl.NumberFormat("vi-VN").format(value);
  if (code === "TIMEOUT") return { code, message: t("errors.TIMEOUT", { seconds: n(typeof body.timeoutSeconds === "number" ? body.timeoutSeconds : 10) }) };
  if (code === "INVALID_CREDENTIALS" && typeof body.remainingBeforeLock === "number") return { code, message: t("errorAdvice.INVALID_CREDENTIALS_COUNT", { count: n(body.remainingBeforeLock) }) };
  if (code === "RATE_LIMITED" && typeof body.retryAfter === "number") return { code, message: t("errorAdvice.RATE_LIMITED_TIME", { seconds: n(body.retryAfter) }) };
  // Only wire codes live under errors.*; internal templates use errorAdvice.*.
  // Unknown codes and empty raw detail retain the original HTTP fallback.
  const key = `errors.${code}`;
  if (isMessageKey(key) && !(detail === "" && PASSTHROUGH.has(code))) return { code, message: t(key) };
  if (error.status >= 500) return { code, message: t("errorAdvice.HTTP_SERVER", { status: error.status }) };
  return { code, message: error.message || t("errorAdvice.HTTP_FAILURE", { status: error.status }) };
}
