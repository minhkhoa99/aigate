import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { navigation, extraRoutes } from "../app/navigation.ts";
import { ApiError } from "./api.ts";
import { toProblem } from "./errors.ts";

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
  assert.equal(mod.isMessageKey("common.retry"),true);
  for (const key of ["constructor", "__proto__", "errors.unknown"]) assert.equal(mod.isMessageKey(key),false);
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
    for (const ratio of [-.123,0,.123]) assert.equal(f.signedPercent(ratio),new Intl.NumberFormat(locale, {
      style:"percent",minimumFractionDigits:1,maximumFractionDigits:1,signDisplay:"always",
    }).format(ratio));
    assert.equal(f.compact(12000),new Intl.NumberFormat(locale,{notation:"compact",maximumFractionDigits:1}).format(12000));
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
test("unknown wire codes cannot select internal advice templates", () => {
  for(const language of ["en","vi"]) for(const code of ["HTTP_SERVER","HTTP_FAILURE","UNEXPECTED","OAUTH_DETAIL","MODELS_DETAIL","VOICES_DETAIL","INVALID_CREDENTIALS_COUNT","RATE_LIMITED_TIME"]) {
    const raw = `raw diagnostic for ${code}: model/x <tag>`;
    assert.deepEqual(toProblem(new ApiError(400,code,raw),language),{code,message:raw});
    assert.deepEqual(toProblem(new ApiError(503,code,raw),language),{
      code,message:toProblem(new ApiError(503,"HTTP_503",raw),language).message,
    });
  }
});
test("real shared UI renders the saved locale and treats supplied copy as literal", async () => {
  const { createServer } = await import("vite");
  const { createElement: h } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const server = await createServer({ root:fileURLToPath(new URL("../../",import.meta.url)), logLevel:"error",
    configFile:false, server:{middlewareMode:true,watch:null,hmr:false}, esbuild:{jsx:"automatic"}, optimizeDeps:{noDiscovery:true,include:[]} });
  const old = Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis,"window");
  let language = "vi";
  try {
    Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:()=>language}});
    const { LocaleProvider } = await server.ssrLoadModule("/src/shared/locale.tsx");
    const { StateBlock, CopyField } = await server.ssrLoadModule("/src/shared/ui.tsx");
    const html = renderToStaticMarkup(h(LocaleProvider,null,h(StateBlock,{state:"loading"}),h(CopyField,{value:"<raw>&model/x"})));
    assert.ok(html.includes("Đang tải nội dung"));
    assert.ok(html.includes("Sao chép"));
    assert.ok(html.includes("&lt;raw&gt;&amp;model/x"));
    const { createRouter, createRootRoute, createMemoryHistory, RouterProvider } = await import("@tanstack/react-router");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { ToastProvider } = await server.ssrLoadModule("/src/shared/toast.tsx");
    const render = async (component, client = new QueryClient()) => {
      const router = createRouter({routeTree:createRootRoute({component}), history:createMemoryHistory({initialEntries:["/"]})});
      await router.load();
      return renderToStaticMarkup(h(LocaleProvider,null,h(QueryClientProvider,{client},h(ToastProvider,null,h(RouterProvider,{router})))));
    };
    const { SettingsGeneral, SettingsAuth, SettingsDeveloper, Login, Onboarding } = await server.ssrLoadModule("/src/features/settings/screens.tsx");
    const general = await render(() => h(SettingsGeneral,{theme:"dark",onTheme:()=>{}}));
    assert.ok(general.includes("Cài đặt chung"), "General owned heading must be Vietnamese");
    assert.ok((await render(SettingsAuth)).includes("Xác thực &amp; truy cập"));
    assert.ok((await render(() => h(SettingsDeveloper,{enabled:false,onChange:()=>{}}))).includes(mod.translate("vi","developer.title")));
    assert.ok((await render(Login)).includes(mod.translate("vi","auth.welcomeBack")));
    assert.ok((await render(Onboarding)).includes(mod.translate("vi","auth.secureGateway")));
    const { Overview } = await server.ssrLoadModule("/src/features/overview/screens.tsx");
    assert.ok((await render(Overview)).includes("Tổng quan gateway"), "Overview owned heading must be Vietnamese");
    Object.defineProperty(globalThis,"window",{configurable:true,value:{location:{origin:"http://localhost:20200"}}});
    const runtimeClient = new QueryClient(); runtimeClient.setQueryData(["settings","runtime"],{
      at:0,bindAddress:"127.0.0.1",port:20200,dataDir:"D:/raw/model-x",nodeVersion:"v22.raw",databaseDriver:"node:sqlite",
      uptimeSeconds:120,streamIdleTimeoutMs:30000,usageTimezone:"UTC",usageRetentionDays:12345,dailyRetentionDays:365,
      writer:{queued:12345,dropped:2,failed:0},
    });
    const runtimeHtml = await render(() => h(SettingsGeneral,{theme:"dark",onTheme:()=>{}}),runtimeClient);
    for(const text of ["12.345 ngày", "20200", "AIGATE_DATA_DIR", "D:/raw/model-x", "v22.raw / node:sqlite"]) assert.ok(runtimeHtml.includes(text),text);
    const developerHtml = await render(() => h(SettingsDeveloper,{enabled:true,onChange:()=>{}}),runtimeClient);
    assert.ok(developerHtml.includes("12.345"));
    const metrics = { requests:0, errors:0, tokens:0, cost:0, unpriced:0 };
    const summary = { at:Date.UTC(2026,9,6,18), timezone:"Asia/Ho_Chi_Minh", uptimeSeconds:3660,
      enabledConnections:12345, quotaChecked:0, current:metrics, previous:metrics, buckets:[],
      providers:[{provider:"provider/raw",name:"Raw Provider Name",enabledConnections:1,requests:0,errors:0,errorRate:null,health:"unknown"}],
      providersTruncated:false, attention:[{id:"1",provider:"provider/raw",name:"Raw Account",kind:"expiry",tone:"warning",message:"raw diagnostic model/x HTTP_401 <tag>",until:Date.UTC(2026,9,7)}],
      attentionTruncated:false, writer:{queued:0,dropped:0,failed:0} };
    const client = new QueryClient(); client.setQueryData(["overview"],summary);
    const vi = await render(Overview,client);
    for (const text of ["12.345", "Raw Provider Name", "raw diagnostic model/x HTTP_401 &lt;tag&gt;", "Không đổi", "Chưa có lưu lượng", "Asia/Ho_Chi_Minh"]) assert.ok(vi.includes(text),text);
    assert.ok(vi.includes(mod.createFormatters("vi",summary.timezone).time(summary.at)));
    assert.ok(!vi.includes("Upstream calls in flight"));
    language = "en";
    const en = await render(Overview,client);
    for (const text of ["12,345", "raw diagnostic model/x HTTP_401 &lt;tag&gt;", "No change", "Gateway overview"]) assert.ok(en.includes(text),text);
    client.setQueryData(["overview"],{...summary,current:{...metrics,requests:2,errors:1,cost:.0001,unpriced:1},previous:{...metrics,requests:1},writer:{queued:0,dropped:2,failed:3}});
    language = "vi";
    const partial = await render(Overview,client);
    assert.ok(partial.includes("chi phí chưa đầy đủ")); assert.ok(partial.includes("Ghi usage bị mất dữ liệu"));
    assert.ok(partial.includes("50,0%")); assert.ok(partial.includes("US$"));
    Object.defineProperty(globalThis,"localStorage",{configurable:true,get:()=>{throw Error("denied");}});
    const denied = renderToStaticMarkup(h(LocaleProvider,null,h(StateBlock,{state:"loading"})));
    assert.ok(denied.includes("Loading content"));
  } finally {
    if(old) Object.defineProperty(globalThis,"localStorage",old); else delete globalThis.localStorage;
    if(oldWindow) Object.defineProperty(globalThis,"window",oldWindow); else delete globalThis.window;
    await server.close();
  }
});
