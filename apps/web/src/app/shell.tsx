import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import { navigation } from "./navigation";
import { ScreenView } from "./screens";
import { Dot, StateBlock } from "../shared/ui";
import { authStatusKey, useAuthStatus } from "../features/settings/api";
import { toProblem } from "../shared/errors";
import { ApiError, SESSION_ENDED_EVENT } from "../shared/api";
import { useToast } from "../shared/toast";
import { useLocale } from "../shared/locale";
import type { MessageKey } from "../shared/i18n";

function currentLabel(path: string, t: (key: MessageKey) => string): string {
  for (const group of navigation) for (const item of group.items) if (item.href === path) return t(item.labelKey);
  if (path === "/gateway/routing/new") return t(new URLSearchParams(window.location.search).has("combo") ? "nav.editCombo" : "nav.createCombo");
  if (path.startsWith("/providers/media/")) return t("nav.mediaDetail");
  if (path.startsWith("/providers/")) return t("nav.providerDetail");
  if (path.startsWith("/traffic/requests/")) return t("nav.requestDetail");
  if (path.startsWith("/integrations/cli-tools/")) return t("nav.cliDetail");
  return t("nav.overview");
}

export function Shell() {
  const { language, t } = useLocale();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const auth = useAuthStatus();
  const queryClient = useQueryClient();
  const showToast = useToast();
  // Logout in another tab, a password change, or the 24 h expiry: tell the user, then re-check status.
  useEffect(() => {
    const onSessionEnded = () => {
      showToast({ tone: "error", error: new ApiError(401, "UNAUTHENTICATED", "") });
      void queryClient.invalidateQueries({ queryKey: authStatusKey });
    };
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
  }, [queryClient, showToast]);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("aigate-theme") ?? "dark"; } catch { return "dark"; } });
  const [developerMode, setDeveloperMode] = useState(() => { try { return localStorage.getItem("aigate-developer") === "true"; } catch { return false; } });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const uiStateParam = new URLSearchParams(window.location.search).get("uiState");
  const uiState = uiStateParam === "loading" || uiStateParam === "empty" || uiStateParam === "error" ? uiStateParam : "ready";
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("aigate-theme", theme); } catch { /* browser persistence is optional */ } }, [theme]);
  const standalone = path === "/welcome" || path === "/login" || path === "/callback";
  if (standalone) return <ScreenView path={path} developerMode={developerMode} onDeveloperMode={setDeveloperMode} theme={theme} onTheme={setTheme} />;
  // Console pages need a session (docs/contracts/identity-apikeys.md); the server enforces it, this only routes.
  if (auth.isPending) return <div className="standalone"><div className="auth-card"><StateBlock state="loading" /></div></div>;
  if (auth.isError) return <div className="standalone"><div className="auth-card"><StateBlock state="error" code={toProblem(auth.error).code}
    action={<button type="button" className="button button-primary" onClick={() => void auth.refetch()}>{t("common.retry")}</button>} /></div></div>;
  if (auth.data.setupRequired) return <Navigate to="/welcome" />;
  if (!auth.data.authenticated) return <Navigate to="/login" />;

  const needle = search.normalize("NFC").toLocaleLowerCase(language);
  const visibleGroups = navigation.map((group) => ({ ...group, items: group.items.filter((item) =>
    (!("devOnly" in item) || developerMode) && (!needle || [item.label, t(item.labelKey)].some(label => label.normalize("NFC").toLocaleLowerCase(language).includes(needle))))
  })).filter((group) => group.items.length > 0);

  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    {mobileOpen && <button className="mobile-backdrop" aria-label={t("shell.closeMenu")} onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label={t("shell.navigation")}>
      <div className="brand"><div className="brand-mark">⌘</div><div className="brand-copy"><strong>AIGate</strong><small>{t("shell.localGateway")}</small></div>
        <button className="sidebar-toggle" aria-label={t(collapsed ? "shell.expand" : "shell.collapse")} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "›" : "‹"}</button></div>
      <div className="workspace"><Dot tone="info" /><div><strong>{t("shell.instance")}</strong><small>{t("shell.dashboard")}</small></div><span>⌄</span></div>
      <nav className="sidebar-nav">{visibleGroups.map((group) => <div className="nav-group" key={group.group}>
        <div className="nav-group-label">{t(group.groupKey)}</div>{group.items.map((item) => <Link key={item.href} to={item.href} onClick={() => setMobileOpen(false)}
          aria-current={path === item.href ? "page" : undefined} className={`nav-link ${path === item.href ? "selected" : ""}`} title={t(item.labelKey)}>
          <span className="nav-icon" aria-hidden="true">{item.icon}</span><span className="nav-text">{t(item.labelKey)}</span></Link>)}</div>)}</nav>
      <div className="sidebar-foot"><div className="system-line"><Dot tone="info" /> <span>{t("shell.session")}</span><strong>{t("shell.signedIn")}</strong></div><small>{t("shell.liveHint")}</small></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label={t("shell.openMenu")} onClick={() => setMobileOpen(true)}>☰</button>
        <span className="muted">gateway</span><span className="muted">/</span><strong>{currentLabel(path, t)}</strong></div>
        <div className="top-actions"><label className="top-search"><span>⌕</span><input type="search" name="navigation-search" autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("shell.search")} aria-label={t("shell.search")} /><kbd>⌘ K</kbd></label>
          <span className="latency"><Dot tone="info" /> RT --</span><button className="icon-button" aria-label={t("shell.theme")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "◐"}</button>
          <button className="icon-button" aria-label={t("shell.notifications")}>♧</button><span className="user-chip"><span>AL</span> admin@local</span></div>
      </header>
      <main id="main-content" className="content"><ScreenView path={path} state={uiState} theme={theme} onTheme={setTheme} developerMode={developerMode} onDeveloperMode={(value) => {
        setDeveloperMode(value); try { localStorage.setItem("aigate-developer", String(value)); } catch { /* browser persistence is optional */ }
      }} /></main>
    </div>
  </div>;
}
