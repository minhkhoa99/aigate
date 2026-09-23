import re, glob, os, html as H

NAV = ["Overview","Endpoint & Keys","Routing & Fallback","Token Saver","LLM Providers",
       "Media Providers","Connections","Quota","Usage","Requests","Proxy Pools","Tunnel",
       "MITM","CLI Tools","Skills","MCP"]
SHELL_LESS = {"login-callback","onboarding"}   # by design: outside the shell

SKEL  = re.compile(r"animate-pulse|skeleton", re.I)
EMPTY = re.compile(r"no (traffic|requests|data|connections|results|providers|keys|logs)\b|empty", re.I)
ERRC  = re.compile(r"\bERR_[A-Z0-9_]{3,}|\b(4\d\d|5\d\d)\b")
RETRY = re.compile(r"try again|retry", re.I)
SECRET= re.compile(r"sk-[A-Za-z0-9_-]{8,}|ghp_\w{10,}|eyJ[A-Za-z0-9_-]{20,}|AIza[\w-]{20,}|Bearer +[A-Za-z0-9._-]{16,}")

rows=[]
for f in sorted(glob.glob("html/*.html")):
    slug=os.path.basename(f)[:-5]
    t=open(f,encoding="utf-8",errors="ignore").read()
    txt=H.unescape(re.sub(r"<[^>]+>"," ",t))
    miss=[n for n in NAV if n.lower() not in txt.lower()]
    if slug in SHELL_LESS: miss=["(n/a shell-less)"] if len(miss)>8 else miss
    rows.append(dict(
        slug=slug,
        nav="OK" if not miss else ("MISS:"+",".join(miss)),
        skel="y" if SKEL.search(t) else "-",
        empty="y" if EMPTY.search(txt) else "-",
        err="y" if ERRC.search(txt) else "-",
        retry="y" if RETRY.search(txt) else "-",
        secret=";".join(sorted(set(SECRET.findall(t)))[:2]) or "-",
    ))

w=max(len(r["slug"]) for r in rows)
print(f'{"SCREEN".ljust(w)}  SKEL EMPTY ERR RETRY  NAV')
for r in rows:
    print(f'{r["slug"].ljust(w)}   {r["skel"]}    {r["empty"]}    {r["err"]}    {r["retry"]}    {r["nav"]}')
print("\n=== SECRET-LIKE STRINGS ===")
for r in rows:
    if r["secret"]!="-": print(f'{r["slug"]}: {r["secret"]}')
