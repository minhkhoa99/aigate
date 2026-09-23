import re,glob,os,html as H
for f in ["html/overview.html","html/usage.html","html/mitm.html","html/settings-auth.html"]:
    t=open(f,encoding="utf-8",errors="ignore").read()
    m=re.search(r'<(aside|nav)[^>]*>.*?</\1>', t, re.S)
    if not m: print(os.path.basename(f), "NO <aside>/<nav>"); continue
    txt=H.unescape(re.sub(r'<[^>]+>','|',m.group(0)))
    items=[x.strip() for x in txt.split('|') if x.strip()]
    print(f"--- {os.path.basename(f)} ({len(items)} items)")
    print("   ", " · ".join(items[:40]))
