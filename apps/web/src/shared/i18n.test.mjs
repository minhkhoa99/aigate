import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { navigation, extraRoutes } from "../app/navigation.ts";
import { ApiError } from "./api.ts";
import { toProblem } from "./errors.ts";

// Missing implementation is reported as a behavioral assertion, not a loader crash.
const mod = await import("./i18n.ts");
test("locale catalogs preserve keys and placeholder counts", async () => {
  assert.ok(mod);
  const en = JSON.parse(await readFile(new URL("./locales/en.json", import.meta.url), "utf8"));
  const vi = JSON.parse(await readFile(new URL("./locales/vi.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
  const names = text => [...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(m => m[1]).sort();
  for (const key of Object.keys(en)) {
    assert.equal(typeof en[key], "string"); assert.equal(typeof vi[key], "string");
    assert.ok(en[key].trim() && vi[key].trim(), key);
    assert.deepEqual(names(vi[key]), names(en[key]), key);
  }
});
test("locale storage denial and unsupported preferences fall back", () => {
  assert.ok(mod);
  for (const value of [null, undefined, "fr", "VI", 1]) assert.equal(mod.normalizeLanguage(value), "en");
  assert.equal(mod.normalizeLanguage("vi"), "vi");
  assert.equal(mod.readLanguage(() => { throw Error("denied"); }), "en");
  let stored; assert.equal(mod.persistLanguage("vi", value => { stored = value; }), true);
  assert.equal(stored, "vi");
  assert.equal(mod.persistLanguage("vi", () => { throw Error("denied"); }), false);
});
test("locale lookup and interpolation do not interpret inherited keys or parameter text", () => {
  assert.ok(mod);
  const catalogs = { en: { greeting: "Hello {name}" }, vi: {} };
  assert.equal(mod.lookupMessage("vi", "greeting", catalogs), "Hello {name}");
  for (const key of ["constructor", "__proto__", "unknown"]) assert.equal(mod.lookupMessage("vi", key, catalogs), key);
  assert.equal(mod.interpolate("{name} / {count}", { name: "<img>$&{count}", count: 2 }), "<img>$&{count} / 2");
  assert.equal(mod.interpolate("{missing}"), "{missing}");
  assert.equal(mod.translate("vi", "common.retry"), "Thử lại");
});
test("locale formatters preserve money precision, percentages and timezone", () => {
  assert.ok(mod);
  for (const language of ["en", "vi"]) {
    const locale = language === "vi" ? "vi-VN" : "en-US";
    const f = mod.createFormatters(language, "Asia/Ho_Chi_Minh");
    assert.equal(f.number(12345), language === "vi" ? "12.345" : "12,345");
    for (const value of [0, 0.0001, 0.02, 1234.5, -1]) assert.equal(f.usd(value), new Intl.NumberFormat(locale, {
      style: "currency", currency: "USD", minimumFractionDigits: value > 0 && value < 0.01 ? 4 : 2, maximumFractionDigits: 4,
    }).format(value));
    assert.equal(f.percent(.123), new Intl.NumberFormat(locale, { style:"percent", minimumFractionDigits:1, maximumFractionDigits:1 }).format(.123));
    const at = Date.UTC(2026,9,6,18);
    assert.equal(f.dateTime(at), new Intl.DateTimeFormat(locale, { timeZone:"Asia/Ho_Chi_Minh", dateStyle:"short", timeStyle:"medium" }).format(at));
  }
});
test("navigation has localized labels without changing route identifiers", () => {
  for (const group of navigation) {
    assert.equal(typeof group.groupKey, "string", "navigation group has no translation key");
    assert.notEqual(mod.translate("vi", group.groupKey), group.groupKey);
    for (const item of group.items) {
      assert.equal(typeof item.labelKey, "string");
      assert.notEqual(mod.translate("vi", item.labelKey), item.labelKey);
      assert.ok(item.href.startsWith("/"));
    }
  }
  assert.equal(navigation[0].items[0].href, "/");
  assert.ok(extraRoutes.includes("/login") && extraRoutes.includes("/callback"));
});
test("localized errors keep codes, numeric context and raw diagnostics", () => {
  const input = new ApiError(0, "TIMEOUT", "", { timeoutSeconds:25 });
  const vi = toProblem(input, "vi");
  assert.equal(vi.code, "TIMEOUT"); assert.match(vi.message, /25/);
  assert.notEqual(vi.message, toProblem(input).message);
  assert.match(toProblem(new ApiError(401,"INVALID_CREDENTIALS","",{remainingBeforeLock:2}),"vi").message,/2/);
  const raw = "provider refused model/x: HTTP 401";
  assert.equal(toProblem(new ApiError(400,"INVALID_REQUEST",raw),"vi").message,raw);
  assert.equal(toProblem(new ApiError(400,"PROVIDER_NOT_SUPPORTED","",{message:raw}),"vi").message,raw);
  assert.ok(toProblem(new ApiError(502,"VOICES_FETCH_FAILED","",{message:raw}),"vi").message.includes(raw));
  assert.equal(toProblem(new ApiError(409,"SETTINGS_CHANGED",""),"vi").code,"SETTINGS_CHANGED");
  assert.match(toProblem(new ApiError(502,"HTTP_502",""),"vi").message,/502/);
});
test("real shared UI renders the saved locale and treats supplied copy as literal", async () => {
  const { createServer } = await import("vite");
  const { createElement: h } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const server = await createServer({ root:fileURLToPath(new URL("../../",import.meta.url)), logLevel:"error",
    configFile:false, server:{middlewareMode:true,watch:null,hmr:false}, esbuild:{jsx:"automatic"}, optimizeDeps:{noDiscovery:true,include:[]} });
  const old = Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  try {
    Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:()=>"vi"}});
    const { LocaleProvider } = await server.ssrLoadModule("/src/shared/locale.tsx");
    const { StateBlock, CopyField } = await server.ssrLoadModule("/src/shared/ui.tsx");
    const html = renderToStaticMarkup(h(LocaleProvider,null,h(StateBlock,{state:"loading"}),h(CopyField,{value:"<raw>&model/x"})));
    assert.ok(html.includes("Đang tải nội dung"));
    assert.ok(html.includes("Sao chép"));
    assert.ok(html.includes("&lt;raw&gt;&amp;model/x"));
    const { createRouter, createRootRoute, createMemoryHistory, RouterProvider } = await import("@tanstack/react-router");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { ToastProvider } = await server.ssrLoadModule("/src/shared/toast.tsx");
    const { SettingsGeneral } = await server.ssrLoadModule("/src/features/settings/general.tsx");
    const router = createRouter({routeTree:createRootRoute({component:()=>h(SettingsGeneral,{theme:"dark",onTheme:()=>{}})}),
      history:createMemoryHistory({initialEntries:["/"]})});
    await router.load();
    const general = renderToStaticMarkup(h(LocaleProvider,null,h(QueryClientProvider,{client:new QueryClient()},h(ToastProvider,null,h(RouterProvider,{router})))));
    assert.ok(general.includes("Cài đặt chung"), "General owned heading must be Vietnamese");
  } finally {
    if(old) Object.defineProperty(globalThis,"localStorage",old); else delete globalThis.localStorage;
    await server.close();
  }
});
