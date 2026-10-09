# Token Saver EN/VI presentation (SP35 / M3 U6)

SP35 completes the existing Token Saver dashboard's owned EN/VI text. It moves
the screen into its own gateway module to keep the route file bounded. The
settings and PXPIPE API hooks, paths, payload keys, stage order and server
behavior remain those in `token-saver.md` and `settings.md`. No new API,
dependency, preference, install action or background request is introduced.

The screen localizes headings, descriptions, switches, pipeline status,
Headroom field, level labels, PXPIPE availability, loading/error/Retry and
install feedback. `RTK`, `Headroom`, `Caveman`, `Ponytail`, `PXPIPE`, the
`x-aigate-token-saver: off` header, URL path and saved `lite`/`full`/`ultra`
values remain literal. A locale change must preserve the mounted Headroom URL
draft, selected stage/level, in-flight settings PATCH or explicit PXPIPE
install. It must not issue a PATCH, POST or extra read by itself. Error toasts
resolve through the shared locale at render time; stable API codes and
permitted raw diagnostics remain visible.

PXPIPE read loading and failure are distinct from `installed: false`. A failed
status read shows its code/message and Retry, without offering Install. An
installed package whose public transform cannot load is shown as unavailable;
the existing explicit install action may retry it. The dashboard never
automatically installs PXPIPE. Browser acceptance uses synthetic same-origin
responses and rejects any unexpected mutation or vendor request.
