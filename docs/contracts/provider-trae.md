# Trae SOLO provider

`TraeAdapter` implements the reference's SOLO remote chat lane behind the framework-free `AIProviderPort`. OAuth and token storage are in [`oauth.md`](oauth.md#trae); the behavior matrix is `provider.trae-solo`.

## Request

Each canonical turn creates one `POST https://core-normal.trae.ai/api/remote/v1/chat_sessions`. The adapter sends `Authorization: Cloud-IDE-JWT <token>`, JSON content type, the Trae web client/language/region headers, `Referer: https://solo.trae.ai/`, and the reference browser user agent.

System messages become `[System]` blocks; assistant messages become `[Assistant]`; user and tool messages become plain text. The joined text is JSON encoded as Trae's typed text block. `auto` selects `mode=code`, `model_selection_strategy=auto`, and an empty model name. `work`, `auto-work`, and `solo-work` select work mode. Other ids select code/manual with that model name. Identity and region fields from the sealed OAuth data are encoded in `common_params`; the connection session id is sent as `biz_session_id` when present.

The create response must be 2xx, `code: 0`, and include `chat_session_id` and `message_id`. The adapter then reads `GET /chat_sessions/{id}/events?reply_to_message_id={message_id}`. OAuth guidance, token exchange, and profile lookup try their respective fixed HTTPS origins in order; callback `loginHost` never controls the upstream destination.

## Response

The bounded SSE parser keeps `event:` and joined `data:` fields, with a 1 MiB event bound and 64 MiB per stream. `plan_item` carries cumulative `thought` text keyed by event id; only appended text is emitted. `token_usage` maps prompt/completion counts to CIP. `done` ends the response. EOF without `done` is accepted to preserve the reference behavior and remains `SUSPECTED_BUG` in the matrix.

An `error` event raises `PROVIDER_UNAVAILABLE`; HTTP 401/403 map to `AUTH_ERROR`. The client abort signal flows to both upstream requests. Model discovery is the nine static reference ids; no live catalog request is made. The connection test validates that a token exists and its stored expiry is not due; it does not make a chat request.

The reference flattens text and ignores image/tool definitions on this lane. AIGate keeps that behavior. CIP has no streaming error chunk, so an upstream event error becomes a routed provider error.
