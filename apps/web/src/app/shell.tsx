import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { navigation } from "./navigation";
import { ScreenView } from "./screens";
import { Dot } from "../shared/ui";

function currentLabel(path: string): string {
  for (const group of navigation) for (const item of group.items) if (item.href === path) return item.label;
  if (path.startsWith("/providers/media/")) return "Media Provider";
  if (path.startsWith("/providers/")) return "Provider Detail";
  if (path.startsWith("/traffic/requests/")) return "Request Detail";
  if (path.startsWith("/integrations/cli-tools/")) return "CLI Tool Detail";
  return "Overview";
}

export function Shell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [theme, setTheme] = useState(() => localStorage.getItem("aigate-theme") ?? "dark");
  const [developerMode, setDeveloperMode] = useState(() => localStorage.getItem("aigate-developer") === "true");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const uiStateParam = new URLSearchParams(window.location.search).get("uiState");
  const uiState = uiStateParam === "loading" || uiStateParam === "empty" || uiStateParam === "error" ? uiStateParam : "ready";
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("aigate-theme", theme); }, [theme]);
  const standalone = path === "/welcome" || path === "/login" || path === "/callback";
  if (standalone) return <ScreenView path={path} developerMode={developerMode} onDeveloperMode={setDeveloperMode} />;

  const visibleGroups = navigation.map((group) => ({ ...group, items: group.items.filter((item) =>
    (!("devOnly" in item) || developerMode) && (!search || item.label.toLowerCase().includes(search.toLowerCase())))
  })).filter((group) => group.items.length > 0);

  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    {mobileOpen && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label="Main navigation">
      <div className="brand"><div className="brand-mark">⌘</div><div className="brand-copy"><strong>AIGate</strong><small>LOCAL GATEWAY</small></div>
        <button className="sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "›" : "‹"}</button></div>
      <div className="workspace"><Dot tone="info" /><div><strong>Local instance</strong><small>UI preview</small></div><span>⌄</span></div>
      <nav className="sidebar-nav">{visibleGroups.map((group) => <div className="nav-group" key={group.group}>
        <div className="nav-group-label">{group.group}</div>{group.items.map((item) => <Link key={item.href} to={item.href} onClick={() => setMobileOpen(false)}
          aria-current={path === item.href ? "page" : undefined} className={`nav-link ${path === item.href ? "selected" : ""}`} title={item.label}>
          <span className="nav-icon" aria-hidden="true">{item.icon}</span><span className="nav-text">{item.label}</span></Link>)}</div>)}</nav>
      <div className="sidebar-foot"><div className="system-line"><Dot tone="info" /> <span>System status</span><strong>PREVIEW</strong></div><small>Demo data · backend pending</small></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}>☰</button>
        <span className="muted">gateway</span><span className="muted">/</span><strong>{currentLabel(path)}</strong></div>
        <div className="top-actions"><label className="top-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pages" aria-label="Search pages" /><kbd>⌘ K</kbd></label>
          <span className="latency"><Dot tone="info" /> RT --</span><button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "◐"}</button>
          <button className="icon-button" aria-label="Notifications">♧</button><span className="user-chip"><span>AL</span> admin@local</span></div>
      </header>
      <main id="main-content" className="content"><ScreenView path={path} state={uiState} developerMode={developerMode} onDeveloperMode={(value) => {
        setDeveloperMode(value); localStorage.setItem("aigate-developer", String(value));
      }} /></main>
    </div>
  </div>;
}
