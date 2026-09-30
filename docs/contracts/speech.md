# Speech contract (M2 SP23)

Text to speech on `/v1/audio/speech`, the public voice list `/v1/audio/voices`, and the dashboard's voice list and preview. Matrix: `docs/discovery/feature-matrix/09-media-providers.yaml` (`media.tts-lane`, `media.tts-voice-listing`, `media.tts-dashboard-browser`, `media.tts-openrouter-audio-chunks`, `media.tts-public-voices-omit-minimax`, `media.tts-deepgram-voices-without-synthesis`, `media.tts-unreachable-providers`).

## Providers

`packages/engine/src/tts.ts` holds one route per provider. Each route has a request builder and an audio decoder.

| Provider | Upstream | Auth | Voice | Answer |
|---|---|---|---|---|
| `openai` | `<connection base>/audio/speech` (derived from `chatUrl`) | provider header | `voice` | binary, streamed |
| `openrouter` | `chat/completions`, `modalities: [text, audio]`, `audio: { voice, format: wav }`, `stream: true` | provider header + catalog headers | `audio.voice` | SSE `delta.audio.data`; each chunk decoded, bytes joined, raw PCM16 wrapped as 24 kHz WAV |
| `xiaomi-mimo` | `chat/completions`, `stream: false`, text as the `assistant` message, `Speak in <language>.` and `style` as a `user` message | Bearer (API key or OAuth) | `audio.voice` | `choices[0].message.audio.data` base64 |
| `nvidia` | `<base>/audio/speech`, `{ input: { text }, voice, model }` | Bearer | `voice` (default `default`) | binary, streamed |
| `gemini` | `<base>/models/<model>:generateContent`, `responseModalities: [AUDIO]`, prebuilt voice | `x-goog-api-key` | `prebuiltVoiceConfig.voiceName` (default `Kore`) | PCM from `inlineData`, wrapped as WAV at the `rate` in its mime type (24 kHz default) |
| `minimax`, `minimax-cn` | `https://api.minimax.io/v1/t2a_v2` / `https://api.minimaxi.com/v1/t2a_v2`, hex output, mp3 32 kHz | Bearer | `voice_setting.voice_id` (default `English_expressive_narrator`) | hex audio; a non-zero `base_resp.status_code` is an upstream error |
| `elevenlabs` | `https://api.elevenlabs.io/v1/text-to-speech/<voice>` | `xi-api-key` | path (required, no default) | binary, streamed |
| `inworld` | `https://api.inworld.ai/tts/v1/voice`, `audioConfig: { audioEncoding: MP3 }` | `Basic <key>` | `voiceId` (default `Alex`) | `audioContent` base64 |
| `fish-audio` | `https://api.fish.audio/v1/tts`, model in the `model` header | Bearer | `reference_id` (optional) | binary, streamed |

Gemini gets `Say: <text>` or `Say in <language>: <text>`, unless the text already contains `: `.

ElevenLabs, Inworld, and Fish Audio are media services (`media-services.ts`): they are connectable, and they are tested with a GET of their voice or model list. 401 and 403 mean the key is invalid, a 2xx means active, and anything else means unreachable.

Not offered (see the matrix):
- edge-tts, google-tts, selfhosted-tts, and server-side local-device are deferred.
- aws-polly and Deepgram TTS have no synthesis in 9router.
- cartesia, playht, coqui, and tortoise are hidden.

## `POST /v1/audio/speech` (API key, as every `/v1` route)

Body (JSON): `{ model, input, voice?, language?, style?, speed?, instructions?, response_format? }`.
- `input` is trimmed and must be 1–10 000 characters.
- `speed`, `instructions`, and `response_format` are passed to OpenAI-speech upstreams only.
- The query `?response_format=json` answers `{ audio: <base64>, format }` instead of bytes.

Model string: `<provider>/<model>[/<voice>]`, or a bare model id that the first catalog provider with an active connection declares.
- The model is matched against the provider's TTS models (longest prefix wins).
- Anything left after the model is the voice.
- A string that names no model is a voice for the provider's default model.
- The `voice` field wins over the voice in the model string.

A bare name that is a combo runs its members:
- Fallback and round-robin use the chat lane's rotation and member failover, nested at most `MAX_COMBO_DEPTH` deep.
- Fusion is rejected.

Each member tries the provider's active connections. A connection holding an OAuth refresh token that gets a 401 or 403 is refreshed once and the request sent again (an AIGate addition; 9router's TTS path has none). No TTS provider signs in with OAuth in AIGate yet, so today this applies to no connection. A 401, 402, 403, 429, or 5xx locks `tts:<model>` on that connection with the media cooldowns and moves to the next connection. Binary answers are streamed with backpressure. Decoded formats are buffered up to 16 MiB. A client disconnect aborts the upstream call.

Content types: `audio/mpeg` for mp3, `audio/wav` for wav, otherwise the upstream's.

Errors (OpenAI shape):

| Status | `code` | When |
|---|---|---|
| 415 | `unsupported_media_type` | body not JSON |
| 400 | `invalid_tts_request` | missing model, empty or over-long input |
| 400 | `tts_provider_unsupported` | provider has no TTS route |
| 400 | `model_not_found` | model not a TTS model of that provider |
| 400 | `combo_strategy_unsupported` | fusion combo |
| 400 | `combo_too_deep` | nesting bound |
| 404 | `no_active_connection` | no enabled connection |
| 503 | `provider_unavailable` | every connection cooling down (with `retry-after`) |
| 502 | `tts_upstream_error` | no audio, MiniMax `base_resp` error, audio over 16 MiB |
| upstream | upstream body | other upstream failures on the last connection |

## `GET /v1/audio/voices?provider=<id>[&model=<id>][&lang=<code>]` (API key)

The answer is `{ object: "list", data: [{ id, name, lang, gender, model }] }`, where `model` is `<provider>/<model>/<voice>`.
- Preset catalogs: openai, openrouter, gemini, xiaomi-mimo.
- Live catalogs: elevenlabs, inworld, minimax, minimax-cn.
- `lang` matches the voice's language subtag.
- 400 `invalid_request_error` for a provider or model without TTS voices. 404 `no_active_connection` or 502 `voices_fetch_failed` for live catalogs.

## Dashboard API (session)

| Method | Path | Answer |
|---|---|---|
| GET | `/api/providers/:id/voices?model=` | `{ voices: [{ id, name, locale, gender }], live }` |
| POST | `/api/providers/:id/voice-preview` | `{ model, voice }` → audio (≤ 1 MiB, 15 s; the browser waits 20 s so the server's message arrives first) |

Rules for both routes:
- A live list reads the first active connection. It is cached for 10 minutes per connection and key, holds at most 64 lists, reads at most 4 MiB of JSON, and returns at most 2000 voices. Failures are not cached.
- A preview runs the same synthesis as `/v1/audio/speech`, with the fixed sample text, for any provider with a TTS route. The voice must be in the provider's preset or live list, so providers without a voice catalog (nvidia, fish-audio) are not previewable.
- `/api/providers/:id/voices` for a provider without a TTS route but with the tts service kind (edge-tts, local-device) returns its preset list, `live: false`.

Errors:
- 404 `NOT_FOUND`: unknown provider.
- 400 `INVALID_REQUEST`: provider or model without TTS, or a voice not in the list.
- 400 `NO_ACTIVE_CONNECTION`.
- 502 `VOICES_FETCH_FAILED`: live list failure.
- 502 `VOICE_PREVIEW_FAILED`.

All of these reach the voice browser through `apps/web/src/shared/errors.ts`.

## UI

`/providers/media` TTS (`features/providers/voice-browser.tsx`):
- Provider and model pickers.
- Language, region, gender, and text filters. At most 200 rows are shown, with a note to refine the filters.
- Listen, enabled when the provider has a TTS route and an active connection. Installed browser voices play locally.
- Copy for the model string.
- A "Connect <provider> to load its voices" state linking to Connections.
- Retry for a failed live list.
