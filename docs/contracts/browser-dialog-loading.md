# SP61 browser dialog loading

The browser entry keeps the shell, session check, locale, navigation and core
shared controls. `Modal` and `ConfirmDialog` live in a separate shared module
used only by route-loaded feature screens. The initial login/loading path does
not load Radix Dialog and its focus/dismiss dependencies.

On a visited feature route, dialog behavior remains the same: portal and
overlay, accessible title, focus management, Escape/outside close, and the
existing typed-name confirmation with pending-action guards and EN/VI copy.
Closing a dialog restores focus to its opener when that element still exists;
the previous unmount left focus on the page body.
The network may fetch the dialog chunk once and cache it, through the same
route-loading boundary used by SP57. No endpoint, payload, credential handling,
storage key, dependency or vendor interaction changes.
