# AIGate — Design Spec

**Ngày:** 2026-09-22
**Trạng thái:** Đã duyệt (A′, B′, C1, C2, D)
**Nguồn tham chiếu:**
- `docs/governance/rules.md` — chuẩn chất lượng code (lean · bounded · predictable)
- `docs/governance/behavioral.md` — master directive: 9router là behavioral source of truth, không phải template để port
- Codebase 9router tại `E:\9router` — **chỉ dùng ở thời điểm phát triển**. Sản phẩm ship ra: zero 9router

---

## 0. Tóm tắt

AIGate là một AI Gateway/Router **mới, độc lập**. Nó có toàn bộ năng lực của 9router nhưng:

- không dùng lại một dòng code nào của 9router,
- không mang theo kiến trúc, cấu trúc file, hay technical debt của 9router,
- có kiến trúc, giao diện, và thương hiệu riêng.

9router chỉ đóng vai trò **behavioral source of truth** ở thời điểm phát triển. Sản phẩm ship ra: zero 9router.

> `behavioral.md §FINAL`: *"Do not port the old code. Extract its knowledge. Then engineer the new system."*

### Quy mô phải clone

| Hạng mục | Số lượng (đo tại 2026-09-22) |
|---|---|
| JS LOC của 9router | 128.768 (`src/` 78.856 + `open-sse/` 49.912) |
| File JS | 881 |
| API route | 154 |
| Dashboard page | 28 (23 dashboard) |
| Provider registry | Current source snapshot: 111 visible, 10 hidden, 3 disabled imports; recheck upstream at sync time |
| Executor | 29 |
| Translator file | 48 |
| Repo (DB) | 11 |
| Modality lane | 8 |

---

## 1. Quyết định kiến trúc đã khoá

| Hạng mục | Quyết định | Lý do |
|---|---|---|
| Backend | NestJS + **Fastify adapter** | SSE là hot path; cần `reply.raw` + backpressure thật |
| Kiến trúc | Hexagonal, granularity = **bounded context** | Không phải per-endpoint |
| Ngôn ngữ | TypeScript strict | |
| DB | SQLite + **Drizzle ORM** | Cả 4 client (`bun:sqlite`, `better-sqlite3`, `node:sqlite`, `sql.js`) đi qua **một** `drizzle-orm/sqlite-proxy` có khoá tuần tự hoá theo DB: một API async, một kiểu `db`, một migrator (quyết sau SPIKE-1, 2026-09-25) |
| Engine | **Viết mới 100%**, package framework-free | Dữ liệu registry trích bằng script, schema thiết kế mới |
| Frontend | **Vite + React SPA**, NestJS serve static | 1 port lúc production |
| Parity | Contract-level, 3 tầng (xem §8) | |
| Giữ lại từ 9router | endpoint path `/v1` `/v1beta` `/codex` `/responses` | Đó là chuẩn OpenAI/Anthropic/Google, không phải của 9router |
| **Không** giữ | port 20128, format API key cũ, importer `~/.9router`, branding | Sản phẩm độc lập |
| Config dir | `~/.aigate` | |

### 1.1 Rủi ro kỹ thuật cần spike trước

**SPIKE-1 (chặn M0):** xác minh `drizzle-orm/sqlite-proxy` chạy đủ trên `node:sqlite` và `sql.js`. Nếu thất bại, phải quay lại ngã ba DB (raw repository tự viết, hoặc bỏ `sql.js` và mất bảo đảm "cài không cần build tool").

**Kết quả (2026-09-25):** đạt, nhưng chỉ khi có khoá. `sqlite-proxy` không khoá làm mất dữ liệu khi có transaction async đồng thời. Driver sync gốc thì từ chối, hoặc âm thầm phá, transaction async. Vì vậy cả 4 client đi qua một proxy có khoá (`AsyncLocalStorage` cho lệnh trong transaction, `BEGIN/COMMIT` quanh `batch`). Kết quả: 12/12 trên Node 22/24 và Bun. Hệ quả: trong transaction không được await I/O mạng. Chi tiết: `docs/superpowers/spikes/2026-09-25-spike-1-sqlite-drivers.md`.

---

## 2. Layout monorepo

```
aigate/
├── apps/
│   ├── server/          # NestJS + Fastify
│   ├── web/             # Vite + React SPA
│   └── cli/             # npx aigate (launcher + tray)
├── packages/
│   ├── engine/          # provider engine — pure TS, ZERO framework import
│   ├── contracts/       # zod schema + type dùng chung server↔web
│   └── database/        # drizzle schema + migration + driver chain
└── tools/
    ├── parity/          # dev-only. Loại khỏi build, không publish
    └── extract/         # dev-only. Chạy một lần, sinh registry, rồi xoá
```

`packages/engine` đứng **ngoài** NestJS là cốt lõi của hexagonal: domain giao thức provider không được biết framework tồn tại. Cũng nhờ vậy engine test được mà không cần bật server.

---

## 3. Canonical Internal Protocol (CIP)

`behavioral.md §13` bác bỏ mô hình pivot của 9router.

| | 9router | AIGate |
|---|---|---|
| Định dạng trung gian | **OpenAI format** | **Canonical Internal Protocol** — không thuộc vendor nào |
| Hệ quả | Pivot hao hụt → phải vá bằng `direct route` cho từng cặp `source:target` | Không có double-hop để hao hụt |
| Quy mô | 48 translator, tăng theo N² | ~13 protocol adapter (vào) + N provider adapter (ra), tăng tuyến tính |
| Routing engine | Phải hiểu format vendor | Chỉ thấy Canonical |

```
Client req ─▶ ProtocolAdapter(in) ─▶ CanonicalRequest ─▶ RoutingEngine
                                                            │
                                                            ▼
Client res ◀─ ProtocolAdapter(out) ◀─ CanonicalResponse ◀─ ProviderAdapter ─▶ Vendor
```

### 3.1 Hai luật bắt buộc của CIP

CIP có một bẫy: OpenAI-pivot của 9router hao hụt vì OpenAI format không chứa nổi thinking block, tool-id mapping, `cache_control`. Nếu Canonical cũng không phải superset thật thì AIGate lặp lại đúng lỗi đó, chỉ khác tên.

1. **Canonical là superset**, kèm trường `vendorExtensions` có kiểu — thứ chưa model được thì mang theo nguyên vẹn, không rơi.
2. **Không bao giờ drop im lặng.** Field không biểu diễn được → ném `UnsupportedFeature` tường minh.

Hai luật này là thứ khiến AIGate không cần escape hatch `direct route` của 9router.

---

## 4. Domain model & Port

### 4.1 Domain model (`behavioral.md §9`)

```
Provider · ProviderAccount · Credential · Model · ModelCapability
Quota · Usage · TokenUsage
CanonicalRequest · CanonicalResponse · StreamChunk
RoutingPolicy · FallbackPolicy · RoutingDecision · Attempt
AccountLock · Proxy · MediaProvider · Skill
```

`§9` cấm để concept nằm dưới dạng `string` / `object` / `if-else` / magic constant.

Ví dụ cụ thể: 9router lưu khoá tài khoản bằng key string `modelLock_{model}` nhét trong JSON blob. AIGate phải có entity:

```ts
type AccountLock = {
  accountId: AccountId
  modelId: ModelId | null      // null = khoá toàn account
  reason: ErrorCode
  until: Date
}
```

### 4.2 Port — đúng 6, cho 154 endpoint

> **Luật:** Port chỉ tồn tại khi có (a) implementation thứ hai thật sự, hoặc (b) biên I/O bắt buộc phải fake trong test. Còn lại: application gọi thẳng adapter.

| Port | Implementation |
|---|---|
| `AIProviderPort` | theo **họ giao thức**, không theo từng vendor. OpenAI-compatible gánh phần lớn; kiro/cursor/commandcode/vertex/azure có adapter riêng |
| `HttpTransportPort` | relay / proxy / direct / MITM-bypass DNS |
| `CredentialStorePort` | DB hôm nay, keychain OS ngày mai |
| `SecretCipherPort` | mã hoá OAuth token + sudo secret at-rest |
| `ClockPort` | quota reset window, token expiry — test deterministic |
| `EventBusPort` | usage SSE broadcast |

```ts
interface AIProviderPort {
  execute(req: CanonicalRequest, cred: Credential, ctx: ExecCtx): Promise<CanonicalResponse>
  stream(req: CanonicalRequest, cred: Credential, ctx: ExecCtx): AsyncIterable<CanonicalChunk>
  getModels(cred: Credential): Promise<ModelDescriptor[]>
  validateCredential(cred: Credential): Promise<CredentialStatus>
}
```

`ExecCtx` bắt buộc có `signal: AbortSignal`. Tại request boundary, tạo signal bằng
`AbortSignal.any([clientSignal, AbortSignal.timeout(requestBudgetMs)])`; chuyển
cùng signal qua routing, retry, adapter, `fetch`, và việc đọc/stream body. Client
ngắt hoặc hết ngân sách thời gian thì dừng ngay, không fallback/retry tiếp.
`execute` và `stream` không tự tạo một timeout mới làm vượt ngân sách chung.

Retry đi qua **một helper** nhận `operation(attempt, signal)`, signal trên,
`maxAttempts` hữu hạn (> 0), `baseDelayMs`, `maxDelayMs`, và `shouldRetry(error)`.
Helper chặn cấu hình không hợp lệ, dùng exponential backoff có trần và chờ có
thể huỷ bằng signal; chỉ retry lỗi tạm thời của thao tác an toàn để lặp lại.
Không retry sau khi đã gửi chunk đầu tiên cho client. Khi dựng `packages/engine`, đặt
helper ở nơi các provider adapter cùng dùng và test giới hạn attempt, abort,
deadline, và lỗi không thể retry trước khi bật lint cấm retry tự viết.

Settings / apiKey / pricing → **chỉ là Drizzle repository class**. Không interface, không use-case wrapper. Thêm `GetSettingsUseCase` cho `GET /settings` là over-engineering theo `rules.md` mục 1.

### 4.3 Cấu trúc một bounded context

```
modules/<context>/
├── domain/          # entity, value object, logic thuần. Không import ra ngoài domain/
├── application/     # use case + định nghĩa port (chỉ khi có port)
└── infrastructure/  # controller, drizzle repo, provider adapter, mapper
```

### 4.4 Mười bounded context

| # | Context | Gánh gì |
|---|---|---|
| 1 | `identity` | login, JWT cookie, password, OIDC, SAML, Local Mode |
| 2 | `apikeys` | phát/validate/thu hồi API key |
| 3 | `catalog` | registry provider, model, capabilities, alias, pricing |
| 4 | `connections` | credential đa tài khoản, OAuth flow + refresh, `AccountLock` |
| 5 | `routing` | **lõi** — 8 lane, CIP, combo, capacity adapter, token saver |
| 6 | `transport` | proxy pool, relay deploy, outbound proxy, MITM bypass DNS |
| 7 | `usage` | history/daily, quota tracker, request detail, live SSE |
| 8 | `media` | 9 media kind, voice list |
| 9 | `tooling` | CLI tools writer, skills, console log, tunnel, MITM control, MCP |
| 10 | `settings` | settings + guard chống mass-assignment |

---

## 5. Error taxonomy & Fallback policy

```ts
type ErrorCode =
  | 'AUTH_ERROR' | 'RATE_LIMIT' | 'QUOTA_EXHAUSTED' | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT' | 'INVALID_REQUEST' | 'MODEL_UNAVAILABLE' | 'INTERNAL_ERROR'
```

`behavioral.md §20`: **chỉ recoverable mới fallback.** `INVALID_REQUEST` (400 malformed) mà quét qua 4 provider là đốt tiền và đốt thời gian user.

Bảng recoverable phải là **dữ liệu tường minh trong domain**, không phải `if (status === 429 || status === 503)` rải rác.

Fallback là policy tường minh, không phải try/catch lồng nhau:

```
CandidateResolver → [attempt] → classify(error) → recoverable? ─yes→ next candidate
                                                             └─no→  trả lỗi ngay
```

---

## 6. Technical debt KHÔNG được thừa kế

`behavioral.md §27`: *"Code cũ dùng global mutable map không có nghĩa global mutable map là business requirement."*

### 6.1 IMPLEMENTATION ACCIDENT — không mang sang

| 9router | Bản chất | AIGate làm gì |
|---|---|---|
| `global._*` (usage, console ring, combo rotation) | Vá cho việc Next evaluate module nhiều lần | NestJS DI singleton |
| Mutex **global** khi chọn account | Head-of-line blocking giữa các provider | Mutex **keyed theo provider** |
| `modelLock_{model}` là key string trong JSON blob | Thiếu domain model | Entity `AccountLock` |
| `appendRequestLog()` no-op rỗng | Xác chết | Xoá |
| Ghi usage mỗi request theo kiểu fire-and-forget, lỗi bị nuốt bằng `.catch(() => {})` (`usage.write-not-synchronous`; trước đây ghi nhầm là ghi đồng bộ) | Mỗi request một lần ghi DB; crash hoặc lỗi ghi làm mất dòng mà không ai biết | Buffered writer: flush theo interval **hoặc** max-batch, queue có trần, drop-oldest + đếm số drop **và** số lần ghi lỗi |
| Token refresh chạy song song N lần | Lãng phí + race | **Single-flight** theo connectionId |
| `RING_CAP` / `HEAD_KEEP` / `CHARS_PER_TOKEN` magic number | Không đặt tên | Config có tên, có đơn vị |
| Proxy agent LRU không TTL | Socket chết vẫn nằm trong cache | LRU + TTL |
| Fusion panel `Promise.all` trần | Bounded do may mắn | Concurrency limit tường minh |

### 6.2 SUSPECTED BUG — không tự động tái tạo (`§26`)

| ID | Mô tả | Expected |
|---|---|---|
| SB-1 | PXPIPE tại `chatCore.js:287` chỉ kiểm tra `pxpipeEnabled`, **không** kiểm tra master opt-out header của token-saver. Client gửi header tắt token-saver vẫn bị pxpipe xử lý | Opt-out phải tắt toàn tuyến |

Phát hiện thêm trong quá trình discovery → thêm vào bảng này, phân tích expected/actual/impact, **hỏi trước khi quyết**.

### 6.3 Feature KHÔNG clone

| Feature | Lý do |
|---|---|
| **9Remote** | Không có backend, không route, không DB — chỉ là nút + modal quảng cáo sản phẩm bên thứ ba `9remote.cc`. `§14`: parity là *"same **useful** behavior"*. Quảng cáo cho sản phẩm khác không phải behavior hữu ích của AIGate. Thứ thật sự có giá trị là tunnel Tailscale — cái đó clone |

### 6.4 Feature phải quyết dứt điểm ở Phase C

| Feature | Tình trạng ở 9router | Cần quyết |
|---|---|---|
| Basic Chat | Code sống, nav comment out | Ship hay xoá |
| Media combo | `COMBO_KINDS = new Set([])` — khung chết | Làm cho chạy hay bỏ hẳn |
| PXPIPE | Nav comment out nhưng API sống | Ship hay xoá |
| MITM | Page tồn tại, không có trong nav | Đã quyết: ship, vào nhóm Network |

---

## 7. Quy trình bắt buộc cho mỗi feature

`behavioral.md §4` cấm nhảy thẳng vào code. Mỗi feature đi qua 6 phase:

| Phase | Deliverable |
|---|---|
| **A — Discovery** | Trace đủ `UI → API → service → business logic → persistence → provider → external request → response transform`. Liệt kê file chứng minh |
| **B — Behavior extraction** | Trả lời đủ **20 câu** `§3` + **12 câu** `§30` |
| **C — Contract** | Canonical contract mới + error case + edge case. Gắn nhãn `REFERENCE_BEHAVIOR` / `SUSPECTED_BUG` / `IMPLEMENTATION_ACCIDENT` |
| **D — Design** | Thiết kế mới. `§14`: được phép ít function hơn hẳn nếu behavior đúng |
| **E — Implementation** | Code theo skill `writing-lean-bounded-code` |
| **F — Parity verification** | Contract test + golden scenario |

### 7.1 Feature Matrix — artifact bắt buộc (`§6`)

17 cột:

```
Feature · Sub-feature · Trigger · Input · Output · Business Rules · State
· Dependencies · Provider interaction · Fallback · Error cases · Side effects
· Persistence · Performance concerns · Old location · New module · Parity status
```

Phủ đủ **23 nhóm** `§5` liệt kê. Không feature nào tính là hiểu nếu chưa trace đủ luồng.

23 nhóm: Endpoint & API Key · Providers · Provider authentication · OAuth providers · API-key providers · Provider account management · Multi-account · Model registry · Model mapping · Request routing · Auto fallback · Combo / Vision Adapter · Usage · Quota Tracker · Token Saver · CLI Tools · Media Providers · Proxy Pools · Skills · Console Log · Remote functionality · Translation / language functionality · Settings

**Hai nhóm cần làm rõ trước khi trace vì tên mơ hồ:**

- **"Translation / language functionality"** — trong 9router là **hai** thứ khác nhau: engine dịch format (`/api/translator/*`, 6 route) **và** i18n giao diện (`/api/locale`, 1 route). Trace cả hai.
- **"Remote functionality"** — `9remote` (rỗng, đã quyết bỏ) vs `tunnel` Tailscale (thật, 7 route).

### 7.2 Definition of Done (`§29`) — 13 mục, không tự phong

```
[ ] Feature inventory complete      [ ] Unit tests passed
[ ] Business flow documented        [ ] Contract tests passed
[ ] Edge cases identified           [ ] Error cases tested
[ ] Contract defined                [ ] Streaming tested if applicable
[ ] New design reviewed             [ ] Performance risks checked
[ ] Implementation completed        [ ] Security checked
                                    [ ] Behavioral parity checked
```

Thiếu 1 mục → `status != DONE`.

---

## 8. Parity verification

### 8.1 Ba tầng, chỉ tầng 1–2 là cổng chặn

`§24` cấm test implementation details. `§14` nói feature parity ≠ code parity. Vì vậy **không** diff byte-for-byte request mà AIGate gửi lên vendor so với 9router — làm vậy là ép code parity ở tầng translator.

| Tầng | Đo gì | Tư cách |
|---|---|---|
| **1. Client contract** | Response AIGate trả cho client — so **ngữ nghĩa**: thứ tự event, delta nối lại, message ráp xong, tool_call mapping, token usage, error code | **PASS/FAIL. Hợp đồng thật** |
| **2. Vendor acceptance** | Request AIGate gửi lên có được vendor chấp nhận và trả đúng **hạng** response không | **PASS/FAIL** |
| **3. Upstream shape drift** | Diff ngữ nghĩa request-lên giữa AIGate và 9router | **Chỉ cảnh báo**, không chặn. Khác ≠ sai |

### 8.2 Thu tape — lợi dụng chính tính năng của 9router

Không sửa một dòng nào của 9router. Đặt `outboundProxyUrl` của 9router trỏ vào **recording proxy** của mình.

```
client ──> 9router :20128 ──> recording proxy ──> vendor thật
   ▲            │                    │
   └─ ghi ──────┘                    └─ ghi
```

AIGate chạy **port khác** → hai hệ sống song song, so trực tiếp được.

Mỗi kịch bản sinh ra 1 tape 4 phần:

```jsonc
{
  "id": "chat/kiro/thinking-with-tools",
  "clientRequest":   { /* client gửi gì cho gateway */ },
  "upstreamRequest": { /* gateway gửi gì lên vendor  */ },
  "upstreamResponse":{ /* vendor trả gì             */ },
  "clientResponse":  { /* gateway trả gì cho client  */ }
}
```

Replay: nạp `clientRequest` vào AIGate, stub vendor bằng `upstreamResponse` (không gọi mạng, không tốn credit, chạy được trong CI).

### 8.3 Chuẩn hoá trước khi diff

Normalizer đóng băng: timestamp, request-id, nonce, `Date` header, multipart boundary, thứ tự header.

**SSE so theo ngữ nghĩa, không theo chunk** — ranh giới chunk khác nhau là hợp lệ. So: thứ tự event, loại event, chuỗi delta sau khi nối, message ráp xong, ánh xạ tool_call id, số token usage.

### 8.4 Golden scenarios (`§25`) — 13 kịch bản, áp cho **mọi** lane

```
normal completion · stream completion · provider timeout · rate limit
quota exhausted · invalid credentials · token refresh · account failover
provider fallback · client cancellation · partial stream failure
model unavailable · all providers unavailable
```

`client cancellation` và `partial stream failure` gần như không có test ở 9router. Đây là chỗ AIGate phải **hơn**, không phải chỉ bằng.

### 8.5 Đo coverage

`capabilities.md` (bản đặc tả năng lực AIGate, sinh từ discovery) là mẫu số. Mỗi tape đánh dấu nó phủ item nào:

```
provider adapters  27/29  ✗ kiro-binary-edge, cursor-protobuf-tool
protocol adapters  11/13  ✗ ...
routes            151/154
providers         123/123
```

### 8.6 Giới hạn phải nói thẳng

- Provider cần credential thật → chỉ thu tape được ở máy có key. Provider không có key: chỉ phủ được bằng test thường.
- Tape đóng băng hành vi vendor tại thời điểm thu. Vendor đổi format → tape cũ vẫn xanh nhưng production hỏng. Cần định kỳ thu lại.

---

## 9. Lộ trình

### M-1 · DISCOVERY

Phase A+B cho **cả 23 nhóm** `§5` → Feature Matrix đầy đủ + `capabilities.md`.
**Chưa viết một dòng code sản phẩm nào.**

> **A+B làm một lần cho toàn hệ ở M-1. C→F làm riêng trong từng SP của M1/M2.**
> Lý do tách: A+B là *hiểu*, và hiểu toàn cảnh trước mới thấy được feature nào chồng lấn feature nào — làm rời từng SP thì phát hiện muộn. C→F là *quyết định và dựng*, gắn chặt với SP đang làm, làm sớm thì lỗi thời trước khi dùng tới.
> Mỗi SP của M1/M2 vì vậy mở đầu bằng Phase C (contract) và kết thúc bằng Phase F (parity) + DONE gate 13 mục.

### M0 · Nền

| SP | Nội dung | Exit criteria |
|---|---|---|
| SP0 | 2 skill + bộ lint cơ học (xem §11) | Agent tự nạp đúng skill; CI đỏ đúng chỗ khi vi phạm |
| SP1 | Monorepo skeleton: pnpm workspace, TS strict, NestJS+Fastify boot, Vite boot, `/health` | `pnpm dev` lên cả 2; prod 1 port |
| SP2 | **SPIKE-1** + Drizzle schema + driver chain 4 tầng + migration runner | 4 driver chạy được, hoặc quyết lại ngã ba DB |
| SP3 | Parity harness 3 tầng + recording proxy + normalizer + coverage report | Thu được tape, replay được, in ra % |
| SP4 | `tools/extract` — trích dữ liệu registry 9router → schema AIGate | 123 entry sinh ra, verify bằng diff |

### M1 · Lát mỏng xuyên suốt (walking skeleton)

Mục tiêu duy nhất: **một** `POST /v1/chat/completions` streaming, API key hợp lệ, qua **một** provider, đủ 13 golden scenario.

| SP | Nội dung | Phạm vi cố ý hẹp |
|---|---|---|
| SP5 | `settings` context | Chỉ read/merge default + guard mass-assignment |
| SP6 | `identity` + `apikeys` | Chỉ password login + validate key. Chưa OIDC/SAML |
| SP7 | `engine`: CIP core, schema registry, capability resolution | Chỉ **1** registry entry |
| SP8 | `transport`: `HttpTransportPort` | Chỉ nhánh direct + timeout |
| SP9 | `engine`: OpenAI-compatible provider adapter | |
| SP10 | `engine`: protocol adapter in/out | Chỉ OpenAI |
| SP11 | `connections` | Chỉ 1 account apikey |
| SP12 | `routing`: chat lane + **streaming Fastify raw + backpressure + cancellation** | SP khó nhất M1 |

**Cổng nghiệm thu M1:** parity tầng 1+2 sạch, 13 golden scenario xanh.

### M2 · Nhân rộng (nhiều nhánh song song)

| SP | Nội dung |
|---|---|
| SP13 | Registry 123 provider |
| SP14 | Provider adapter theo họ giao thức (kiro EventStream, cursor protobuf, commandcode NDJSON, vertex, azure…) |
| SP15 | Protocol adapter đủ 13 format |
| SP16 | OAuth 20 provider: flow + refresh **single-flight** + reactive 401/403 + proactive |
| SP17 | Multi-account fallback: fill-first/round-robin/sticky, `AccountLock`, mutex keyed theo provider |
| SP18 | `transport` đầy đủ: proxy pool 4 loại, relay auto-deploy, outbound proxy, MITM-bypass DNS, `strictProxy`, LRU+TTL |
| SP19 | Combo: fallback / round-robin / fusion (panel + judge + quorum-grace) + concurrency limit |
| SP20 | Capacity Adapter: pool theo capability, reorder, history trimming |
| SP21 | Token Saver 5 tầng, fail-open toàn tuyến. Sửa SB-1 |
| SP22 | 7 lane còn lại: embeddings, image, tts, stt, video, search, fetch |
| SP23 | `media`: 9 kind, voice list |
| SP24 | `usage`: history/daily, buffered writer có trần, live SSE, quota, pricing, request detail |
| SP25 | `tooling`: cli-tools, skills, console log, tunnel, MITM, MCP, provider-nodes |

**Cổng nghiệm thu M2:** coverage parity đạt ngưỡng thoả thuận trên toàn bộ `capabilities.md`.

### M3 · UI

Xem §10.10.

---

## 10. Giao diện

### 10.1 Phê bình IA hiện tại của 9router

| Vấn đề | Bằng chứng | Hệ quả |
|---|---|---|
| Settings không có nhà | Không tồn tại `/dashboard/settings`. Auth/SSO/proxy trong `profile`, API key + tunnel trong `endpoint`, token-saver toggle trong `token-saver`, capacity adapter trong `combos` | User phải đoán setting nằm ở trang nào |
| Không có màn hình tổng quan | `/dashboard` redirect thẳng sang `endpoint` | Câu hỏi đầu tiên của mọi user — request có chạy không, provider nào chết — không có chỗ trả lời |
| Feature ship rồi nhưng ẩn | `Sidebar.js:23` basic-chat, `:28` pxpipe, `/dashboard/mitm` không có trong nav | Code sống, đường vào chết |
| Nhóm "Debug" lộ ra product nav | `debugItems` = console-log + translator | Công cụ nội bộ đứng ngang hàng tính năng chính |
| Media kind lộ 5/9 tuỳ tiện | `VISIBLE_MEDIA_KINDS` | Không quy tắc |
| Nav phẳng 12 mục | 3 nhóm rời rạc | Không nhóm theo việc user định làm |
| Page là monolith | `endpoint` 1310 dòng, `proxy-pools` 1063, `providers` 1040, `combos` 855 | Một file gánh fetch + state + form + modal + bảng |

### 10.2 IA mới — 7 nhóm theo *việc*

```
◆ Overview          ← mới. Landing mặc định
◆ Gateway           Endpoint & Keys · Routing & Fallback · Token Saver
◆ Providers         LLM Providers · Media Providers · Connections · Quota
◆ Traffic           Usage · Requests · Console (dev)
◆ Network           Proxy Pools · Tunnel · MITM
◆ Integrations      CLI Tools · Skills · MCP
◆ Settings          General · Auth & Access · Developer
```

Ba luật đi kèm:

1. **Không còn nav item ẩn.** Feature hoặc vào nav, hoặc xoá.
2. **Dev-only nằm sau công tắc** — `Settings → Developer` bật thì Console + Translator + raw request inspector mới hiện. Mặc định tắt.
3. **Media kind hiện đủ 9**; kind chưa có provider nào cấu hình thì hiện disabled kèm lý do, không giấu.

### 10.3 Stack web

| | |
|---|---|
| Build | Vite |
| Router | TanStack Router (type-safe route + search param) |
| Server state | TanStack Query |
| Form | React Hook Form + zod (schema từ `packages/contracts`) |
| Style | Tailwind + primitive tự dựng trên Radix |
| Virtual list | TanStack Virtual |
| Chart | Recharts (lazy) |
| i18n | i18next |

### 10.4 Cấu trúc feature-based

```
apps/web/src/
├── app/                    # shell: router tree, query client, theme, layout
├── features/
│   └── <feature>/
│       ├── api/            # query + mutation, type từ packages/contracts
│       ├── components/     # component riêng feature này
│       ├── hooks/
│       ├── model/          # state cục bộ + logic dẫn xuất
│       └── routes/         # component cấp màn hình, TRẦN ~200 dòng
└── shared/
    ├── ui/                 # design system primitive
    ├── api/                # http client, SSE client, error mapping
    ├── hooks/
    └── lib/
```

**Hai luật giữ cho nó không thối — bản frontend của hexagonal:**

1. **Feature cấm import feature.** Cần dùng chung → nâng lên `shared/`, hoặc ghép ở tầng route. Ép bằng `eslint-plugin-boundaries`.
2. **Component chỉ lên `shared/ui` khi có ≥2 feature dùng thật.** Không "chắc sau này dùng".

### 10.5 Quản lý state — tối thiểu

| Loại state | Cách làm |
|---|---|
| Server state | TanStack Query. **Không** mirror sang store riêng |
| State chia sẻ qua URL (filter, tab, phân trang) | Search param của TanStack Router |
| UI cục bộ | `useState` |
| Stream (usage live, console log) | Hook SSE đẩy thẳng vào Query cache |

Không global store cho tới khi có nhu cầu chứng minh được.

### 10.6 Ràng buộc performance UI (`rules.md` mục 4)

| Rủi ro | Chặn bằng |
|---|---|
| 123 provider, hàng vạn dòng usage, console log | Virtualize mọi list có thể vượt ~50 dòng |
| Fetch toàn bộ usage history | Query **bắt buộc** có `limit` + cursor. Không endpoint nào trả unbounded |
| SSE đẩy DOM phình vô hạn | Ring buffer phía client, trần cứng số node |
| Bundle phình | Code-split theo route. Recharts + Monaco lazy |
| Search gọi API mỗi ký tự | Debounce 200ms + `keepPreviousData` |
| Poll status 13 CLI tool | **1** request gộp, không 13 request |

### 10.7 Quy ước trạng thái cho mọi màn hình

| Trạng thái | Quy tắc |
|---|---|
| Loading lần đầu | Skeleton đúng hình dạng nội dung thật. Không spinner toàn trang |
| Refetch | Giữ dữ liệu cũ + thanh tiến trình mảnh trên cùng. Không nháy trắng |
| Empty | 3 thành phần bắt buộc: nói *chưa có gì*, nói *tại sao*, cho *một nút hành động* |
| Error | Mã lỗi + câu người đọc được + nút Thử lại. Không bao giờ chỉ `Something went wrong` |
| Live/SSE | Chấm trạng thái (xanh: đang nhận · vàng: nối lại · xám: ngắt). Tự reconnect có backoff |
| Thao tác phá huỷ | Modal xác nhận, phải gõ đúng tên đối tượng |
| Optimistic | Chỉ cho toggle rẻ và đảo ngược được. **Không** optimistic cho deploy relay / cài CA |

### 10.8 Bản đồ feature → màn hình

| # | Feature | Route | Nguồn ở 9router |
|---|---|---|---|
| 1 | Overview | `/` | **mới** |
| 2 | Endpoint & Keys | `/gateway/endpoint` | `endpoint/` |
| 3 | Routing & Fallback | `/gateway/routing` | `combos/` + capacity adapter |
| 4 | Token Saver | `/gateway/token-saver` | `token-saver/` + `pxpipe/` + headroom |
| 5 | LLM Providers | `/providers`, `/:id`, `/new` | `providers/` |
| 6 | Media Providers | `/providers/media/:kind`, `/:kind/:id` | `media-providers/` |
| 7 | Connections | `/providers/connections` | rải trong `providers/[id]` |
| 8 | Quota | `/providers/quota` | `quota/` |
| 9 | Usage | `/traffic/usage` | `usage/` |
| 10 | Requests | `/traffic/requests`, `/:id` | request-details — **chưa có UI** |
| 11 | Console | `/traffic/console` | `console-log/` |
| 12 | Proxy Pools | `/network/proxy-pools` | `proxy-pools/` |
| 13 | Tunnel | `/network/tunnel` | trong `endpoint/` |
| 14 | MITM | `/network/mitm` | `mitm/` (orphan) |
| 15 | CLI Tools | `/integrations/cli-tools`, `/:toolId` | `cli-tools/` |
| 16 | Skills | `/integrations/skills` | `skills/` |
| 17 | MCP | `/integrations/mcp` | `/api/mcp` — **chưa có UI** |
| 18 | Settings | `/settings/{general,auth,developer}` | `profile/` + rải rác |
| 19 | Auth | `/login`, `/callback` | `login/`, `callback/` |
| 20 | Onboarding | `/welcome` | **mới** |

### 10.9 Đặc tả từng màn hình

#### 1 · Overview — `/` (mới)

Trả lời trong 3 giây: hệ đang sống không, token/tiền đang cháy ra sao, cái gì đang hỏng.

```
┌─ Gateway  ● Đang chạy   http://localhost:PORT/v1   [Copy]  [Đổi port]
├─ 4 thẻ số:  Request 24h │ Token 24h │ Chi phí 24h │ Tỉ lệ lỗi 24h
│             (mỗi thẻ có sparkline + delta so 24h trước)
├─ ┌────────────── Live requests ──────────────┐ ┌─ Cần chú ý ─────┐
│  │ SSE. 20 dòng mới nhất, ring buffer        │ │ Account bị khoá │
│  │ time · model · provider · ttft · tok · ✓✗ │ │ Token sắp hết   │
│  └───────────────────────────────────────────┘ │ Quota gần cạn   │
└─ Sức khoẻ provider: lưới ô vuông, màu = tỉ lệ lỗi 1h
```

- Dữ liệu: `GET /overview/summary` (**một** request gộp) + SSE `/events/requests`
- Empty: chưa có request nào → panel onboarding dẫn sang CLI Tools
- Ngách: thẻ "Cần chú ý" đọc `AccountLock` + OAuth expiry + quota — 9router rải ba chỗ, không ai gom

#### 2 · Endpoint & Keys — `/gateway/endpoint`

```
┌─ Base URL   [http://localhost:PORT/v1]  [Copy]
│  Tab biến thể:  OpenAI │ Anthropic │ Gemini │ Codex
│  → mỗi tab hiện đúng URL + snippet env cho công cụ đó
├─ API Keys
│  ┌ Bảng: tên · sk-xxxx…xxxx (che) · tạo lúc · dùng lần cuối · trạng thái · ⋯
│  └ [+ Tạo key]
└─ Bảo mật:  Toggle "Bắt buộc API key"  ·  Toggle "Bắt buộc đăng nhập"
```

- Tạo key: modal hiện **toàn bộ key đúng một lần**, có Copy, cảnh báo không xem lại được
- Che key mặc định; nút mắt hiện tạm 10s rồi tự che
- Xoá key: xác nhận gõ tên, cảnh báo công cụ nào đang dùng nếu biết
- Ngách: tab biến thể endpoint — 9router có 5 đường rewrite nhưng UI chỉ hiện một; client double-prefix là nguyên nhân support thường gặp

#### 3 · Routing & Fallback — `/gateway/routing`

Nơi **duy nhất** định đoạt request đi đâu. Gộp combo + fallback + capacity adapter (9router tách rời nên không ai thấy thứ tự ưu tiên tổng thể).

```
┌─ Tab: [ Combo ] [ Fallback ] [ Capacity Adapter ] [ Mô phỏng ]
│
│ Combo:   danh sách combo  →  chi tiết combo
│          ┌ Chế độ: ○ Fallback  ○ Round-robin  ○ Fusion
│          ├ Thành viên: list kéo-thả sắp thứ tự
│          │   mỗi dòng: model · badge năng lực · trạng thái · ✕
│          └ Fusion mở thêm: panel tối thiểu · judge model
│                            · grace stragglers (ms) · hard timeout (ms)
│
│ Fallback: chiến lược đa tài khoản  ○ fill-first  ○ round-robin
│           toggle sticky · bảng AccountLock đang hiệu lực + đếm ngược
│
│ Capacity: 4 pool  vision │ pdf │ audioInput │ videoInput
│           mỗi pool: bật/tắt · round-robin · danh sách model
│
│ Mô phỏng: dán 1 request thật → hiện CÂY quyết định
└            model → candidate → account → lý do chọn/loại
```

- **Mô phỏng là thứ giá trị nhất màn này.** 9router không có cách nào xem trước routing. Dry-run, không gọi vendor
- Cảnh báo: combo không thành viên nào cover được capability → banner vàng chỉ rõ pool nào sẽ nhảy vào
- Ngách: `AccountLock` đếm ngược thời gian thật — 9router chỉ hiện "unavailable" không nói bao giờ hết

#### 4 · Token Saver — `/gateway/token-saver`

```
┌─ Tổng: token tiết kiệm 7 ngày │ % giảm trung bình │ số request bỏ qua
├─ Pipeline (thứ tự thực thi, vẽ thành chuỗi):
│   RTK ▸ Headroom ▸ Caveman ▸ Ponytail ▸ PXPIPE
│   mỗi tầng 1 thẻ:  toggle · mô tả 1 dòng · token tiết kiệm · [Cấu hình]
├─ PXPIPE thêm: trạng thái module (đã nạp / chưa cài) · minChars · timeoutMs
└─ Thử: dán payload → xem trước từng tầng biến đổi gì, diff cạnh nhau
```

- Fail-open: mỗi thẻ hiện số lần tầng đó lỗi và bị bỏ qua. Fail-open mà im lặng thì hỏng vẫn không ai biết
- SB-1: UI phải hiện rõ header nào tắt được tầng nào
- Ngách: PXPIPE "chạy" nghĩa là *module đã nạp*, không phải *port đang lắng nghe*

#### 5 · LLM Providers — `/providers`, `/:id`, `/new`

Provider coverage follows [the active 9Router registry and the 2026-09-24 UI baseline](../../design/provider-parity.md). The first UI pass shows all 111 visible source IDs across LLM and media catalogs. Functional parity requires working auth and routing for every visible ID. Custom providers remain user-created records.

```
danh sách:
┌─ [Tìm]  Lọc: kiểu auth │ đã nối │ có OAuth │ free tier │ năng lực
├─ Lưới card ảo hoá (123 mục):
│   logo · tên · badge auth · "2 tài khoản" · chấm sức khoẻ
└─ [+ Provider tuỳ chỉnh]

chi tiết /:id:
┌─ Header: logo · tên · badge · [Test] [Tài liệu]
├─ Tab: [Tài khoản] [Model] [Cấu hình] [Hoạt động]
│  Tài khoản → bảng connection: nhãn · kiểu cred · trạng thái · quota
│              · hết hạn token · proxy pool · [Test] [Sửa] [Xoá]
│              [+ Thêm tài khoản] → khung AuthFlow
│  Model     → bảng model + badge năng lực + giá + toggle bật/tắt
│  Cấu hình  → baseUrl override · header tuỳ chỉnh · proxy pool · priority
└  Hoạt động → request gần đây của riêng provider này
```

- Perf: 123 card → virtualize + ảnh lazy; lọc chạy client trên dữ liệu đã tải, debounce 200ms
- Ngách: `getEffectiveStatus` — connection `unavailable` nhưng hết lock thì phải hiện lại `active`, kèm tooltip giải thích

#### 6 · Media Providers — `/providers/media/:kind`

```
┌─ Tab kind:  Image │ Video │ TTS │ STT │ Embedding │ Image→Text
│             │ Web Search │ Web Fetch │ Music
│  (kind chưa có provider nào cấu hình → tab mờ + nhãn "chưa cấu hình")
├─ Endpoint của kind này:  /v1/audio/speech   [Copy]
├─ Bảng provider của kind + connection, giống LLM
└─ TTS thêm: trình duyệt giọng — lọc theo ngôn ngữ/vùng/giới tính,
             nút nghe thử, tên vùng dịch qua Intl.DisplayNames
```

#### 7 · Connections & AuthFlow — `/providers/connections`

```
┌─ Bảng: provider · nhãn · kiểu cred · trạng thái · hết hạn · dùng lần cuối
│         · proxy pool · [Test] [Làm mới token] [Xoá]
├─ Lọc: sắp hết hạn │ đang lỗi │ đang bị khoá
└─ Hàng loạt: test tất cả (CÓ giới hạn concurrency, hiện tiến trình)
```

9router có **12 modal xác thực viết tay** (`CursorAuthModal`, `KiroAuthModal`, `KiroSocialOAuthModal`, `GitLabAuthModal`, `IFlowCookieModal`, `OAuthModal`, `ManualConfigModal`…). Đây là ngách sâu nhất của cả UI.

AIGate thay bằng **khung `AuthFlow` khai báo bằng dữ liệu**:

```ts
type AuthStep =
  | { kind: 'text';          field: string; label: string; secret?: boolean }
  | { kind: 'oauth-popup';   authUrl: string }
  | { kind: 'device-code';   pollUrl: string; interval: number }
  | { kind: 'paste-cookie';  instructions: string; probeUrl?: string }
  | { kind: 'import-file';   hint: string }      // đọc config sẵn có trên máy
  | { kind: 'choose-social'; options: SocialOption[] }
  | { kind: 'confirm';       summary: string }
```

12 modal tay → **7 kiểu step**. Provider mới chỉ cần khai báo mảng step. Đây là `§14` đúng nghĩa: behavior y hệt, code ít hơn hẳn.

- Device code: hiện mã to, đếm ngược hết hạn, tự poll có backoff, nút huỷ
- Perf: test hàng loạt có concurrency limit tường minh, **không** `Promise.all` toàn bảng

#### 8 · Quota — `/providers/quota`

```
┌─ Lọc: provider │ chỉ hiện gần cạn
├─ Card mỗi account:
│   ├ vòng tròn tiến trình: đã dùng / hạn mức
│   ├ nguồn quota (vendor báo / mình tự đếm)   ← phải nói rõ
│   ├ đếm ngược tới lúc reset + mốc thời gian tuyệt đối
│   └ dạng quota: request │ token │ tiền │ subscription
└─ Cảnh báo: gần cạn (vàng) · cạn (đỏ) · account bị khoá
```

`§21` cấm chỉ chép UI quota. Phải phân biệt quota **vendor trả về** với quota **mình tự suy ra** — hai thứ độ tin cậy khác nhau, không trộn chung một con số.

#### 9 · Usage — `/traffic/usage`

```
┌─ Khoảng: Hôm nay │ 7d │ 30d │ Tuỳ chọn   (đẩy vào URL search param)
├─ Biểu đồ xếp chồng: token theo ngày, chồng theo provider
├─ Biểu đồ đường: chi phí theo ngày
├─ Bảng phân rã: provider × model — request · in · out · cached · $ · lỗi %
└─ [Xuất CSV]
```

Perf: chart đọc từ bảng đã gộp sẵn theo ngày, **không** quét bảng history. Khoảng tuỳ chọn có trần độ dài; vượt trần thì hạ độ phân giải, không tăng số dòng.

#### 10 · Requests — `/traffic/requests`, `/:id` (mới)

UI cho request-details — 9router có API nhưng **không có màn hình**.

```
danh sách (bảng ảo hoá, cursor pagination):
  time · model · provider · account · trạng thái · TTFT · độ trễ · token · $
  lọc: chỉ lỗi │ provider │ model │ có fallback

chi tiết /:id — timeline dọc theo từng attempt:
  ┌ Attempt 1  provider A / account 1   ✗ RATE_LIMIT  (312ms)
  │            → recoverable → thử tiếp
  ├ Attempt 2  provider A / account 2   ✗ QUOTA_EXHAUSTED
  └ Attempt 3  provider B / account 1   ✓ 200  TTFT 412ms
  Tab: Request (canonical) │ Vendor request │ Vendor response │ Client response
       └ Ba tab sau chỉ hiện khi bật Developer mode
```

`§23`: hiện `requestId · traceId · provider · account · model · attempt · latency · TTFT · token · lý do fallback · trạng thái cuối`.
**Tuyệt đối không hiện** API key / access token / refresh token — redact ở tầng server, không ở client.

#### 11 · Console — `/traffic/console` (dev only)

```
┌─ [▶ Tạm dừng] [Xoá] [Tìm…] Lọc mức: log info warn error debug
├─ Khung log đơn sắc, ring 200 dòng, tự cuộn (dừng khi user cuộn lên)
└─ Chấm SSE + số dòng đã rớt khi buffer tràn
```

Ring 200 dòng là trần cứng **hai phía**: server không giữ nhiều hơn, client không render nhiều hơn. ANSI strip ở server.

#### 12 · Proxy Pools — `/network/proxy-pools`

```
┌─ Bảng pool: tên · loại(http/vercel/cloudflare/deno) · URL · strictProxy
│              · trạng thái test · số connection đang dùng · [Test] [Sửa] [Xoá]
├─ [+ Thêm thủ công]
└─ [⚡ Tự triển khai relay]
    └ wizard 3 bước:
        1. Chọn nền: Vercel │ Cloudflare │ Deno
        2. Dán token  (che, không lưu log, gửi 1 lần)
        3. Deploy → tiến trình có mốc, tối đa 120s, poll tới READY
           → xong: tạo pool sẵn, hiện URL
```

- **strictProxy**: toggle kèm cảnh báo viết đủ câu: *tắt → proxy chết sẽ đi thẳng, IP thật lộ mà không báo*
- Deploy lỗi: giữ log từng bước, không nuốt. Nút thử lại không tạo deployment trùng
- Ngách: cột "đang dùng bởi N connection" → chặn user xoá pool đang chạy

#### 13 · Tunnel — `/network/tunnel`

```
┌─ Trạng thái Tailscale: chưa cài │ đã cài, tắt │ đang chạy
├─ [Cài] → tiến trình có log (thao tác dài, không được chỉ spinner)
├─ Khi chạy: URL public + [Copy] + QR
└─ Cảnh báo bảo mật: mở tunnel = gateway ra Internet.
```

**Ràng buộc cứng:** bắt buộc bật "Yêu cầu API key" trước khi cho phép bật tunnel. Không có API key mà mở tunnel = gateway mở toang cho bất kỳ ai.

#### 14 · MITM — `/network/mitm`

```
┌─ Cảnh báo trên cùng, luôn hiện:
│   Tính năng này cài chứng chỉ gốc vào kho tin cậy của hệ điều hành
│   và sửa file hosts. Chỉ bật nếu bạn hiểu rõ hệ quả.
├─ Trạng thái: CA đã tạo? đã cài? proxy đang chạy? hosts đã sửa?
├─ [Tạo CA] [Cài CA] [Gỡ CA]   ← mỗi nút xác nhận riêng, gõ đúng chữ
├─ Bảng host bị chuyển hướng: host · đang bật · nguồn (mặc định/tự thêm)
└─ Windows: báo rõ khi cần quyền admin, nói trước sẽ hiện hộp thoại UAC
```

Màn hình duy nhất **cấm dùng văn phong ngắn gọn**. Thao tác đụng trust store không đảo ngược dễ.

#### 15 · CLI Tools — `/integrations/cli-tools`, `/:toolId`

```
┌─ Lưới 13 công cụ: Claude Code · Codex · Cursor · Gemini CLI · …
│   mỗi thẻ: logo · đã cài? · đã trỏ về AIGate? · [Cấu hình]
└─ Chi tiết /:toolId:
    ├ Trạng thái hiện tại (đọc từ file config thật của công cụ)
    ├ [Tự động cấu hình] → hiện DIFF file config trước khi ghi
    ├ [Gỡ cấu hình] → khôi phục từ backup
    └ Hướng dẫn thủ công
```

- Perf: **một** request gộp cho cả 13, không 13 request
- An toàn: ghi vào `~/.claude/settings.json` v.v. là ghi vào nhà người ta. **Bắt buộc hiện diff và backup trước khi ghi.** 9router có backup nhưng không cho xem trước

#### 16 · Skills — `/integrations/skills`

```
┌─ Thẻ skill: tên · mô tả · badge "Entry" · [Copy link] [Xem]
└─ Khối "Bắt đầu nhanh": dán link entry cho agent, kèm câu mẫu
```

Trang tĩnh, không state server.

#### 17 · MCP — `/integrations/mcp` (mới)

```
┌─ Bảng MCP server đã cấu hình: tên · lệnh/URL · phạm vi · bật/tắt · [Sửa]
├─ [+ Thêm] · [Marketplace]
└─ Ghi vào: hiện rõ sẽ viết vào file nào của công cụ nào, kèm diff
```

#### 18 · Settings — `/settings/{general,auth,developer}`

| Tab | Nội dung |
|---|---|
| **General** | Ngôn ngữ · theme · port · thư mục dữ liệu · outbound proxy · cập nhật · export/import cấu hình JSON |
| **Auth & Access** | Đổi mật khẩu · bắt buộc đăng nhập · bắt buộc API key · Local Mode · OIDC · SAML |
| **Developer** | Bật dev mode (mở Console + Translator + tab raw ở Requests) · log request · reset dữ liệu |

- Bảo mật: trường secret chỉ hiện cờ `hasPassword` / `oidcConfigured`, **không** hiện giá trị. Đổi mật khẩu bắt buộc nhập mật khẩu hiện tại
- Side-effect: setting có tác dụng phụ (outbound proxy, port) phải nói rõ *"áp dụng ngay"* hay *"cần khởi động lại"*
- Export/Import: thay cho importer `~/.9router` đã bỏ. Format riêng AIGate, **redact secret khi export**, hỏi lại khi import

#### 19 · Auth — `/login`, `/callback`

```
/login:  logo AIGate · ô mật khẩu · [Đăng nhập]
         + nút SSO khi đã cấu hình OIDC/SAML
         + cảnh báo đỏ nếu còn dùng mật khẩu mặc định
/callback: trang chờ xử lý OAuth, lỗi thì nói rõ bước nào hỏng
```

Local Mode bật → bỏ qua `/login` hoàn toàn.

#### 20 · Onboarding — `/welcome` (mới)

```
Bước 1  Đặt mật khẩu           (chặn mật khẩu mặc định ngay từ đầu)
Bước 2  Nối provider đầu tiên  → AuthFlow
Bước 3  Tạo API key            → hiện một lần
Bước 4  Nối công cụ            → CLI Tools, tự cấu hình
Bước 5  Gửi request thử        → thấy nó chạy thật thì mới coi là xong
```

Bước 5 quan trọng nhất: onboarding chỉ tính là hoàn tất khi có **một** request thành công thật.

### 10.10 Chẻ sub-project UI (M3)

| SP | Nội dung | Phụ thuộc |
|---|---|---|
| U0 | Design system: token, primitive trên Radix, theme sáng/tối, trạng thái chuẩn, a11y baseline | — |
| U1 | Shell: router tree, query client, layout, sidebar 7 nhóm, SSE client, error boundary, i18n | U0 |
| U2 | Auth + Onboarding + Settings | M2 settings/identity |
| U3 | Endpoint & Keys | M2 apikeys |
| U4 | Providers + **AuthFlow** + Connections | M2 connections. **SP nặng nhất** |
| U5 | Media Providers | U4 |
| U6 | Routing & Fallback + Mô phỏng | M2 routing/combo |
| U7 | Usage + Quota + Requests | M2 usage |
| U8 | Overview | U3–U7 |
| U9 | Network: Proxy Pools + Tunnel + MITM | M2 transport |
| U10 | Integrations: CLI Tools + Skills + MCP | M2 tooling |
| U11 | Console + dev mode | U1 |

U8 Overview cố ý đứng sau: nó tổng hợp dữ liệu của mọi feature khác, làm sớm là làm hai lần.

---

## 11. Hai skill (SP0)

### 11.1 Nguyên tắc chia: theo *kiểu thất bại*, không theo *file nguồn*

`superpowers:writing-skills` đặt ba ràng buộc:

1. **Trần token:** skill thường nên <500 từ. `rules.md` ~1.500 từ, `behavioral.md` ~2.500 từ → chi tiết nặng phải tách ra file tham chiếu.
2. **Match the Form to the Failure:** hình thức **cấm đoán** phản tác dụng với lỗi sai-hình-dạng; hình thức **công thức** vô dụng với lỗi phá-luật-khi-bị-ép.
3. **Mechanical constraints → automate it.** Cái gì lint chặn được thì đừng bắt agent nhớ.

| Kiểu thất bại | Ví dụ | Hình thức đúng |
|---|---|---|
| Phá luật khi bị ép | Biết phải bounded nhưng vẫn `Promise.all(hugeArray)` cho nhanh | Cấm đoán + bảng nguỵ biện + red flags |
| Sai hình dạng output | Vẫn tuân thủ, nhưng đẻ wrapper/factory/service thừa | **Công thức khẳng định** |
| Nhảy cóc quy trình | Code trước khi hiểu nghiệp vụ, tự phong DONE | Cấm đoán + checklist cấu trúc |

### 11.2 Phân tuyến: máy chặn vs skill dạy

| Luật | Cơ chế | Công cụ |
|---|---|---|
| `Promise.all` trên mảng không giới hạn | Máy chặn | eslint rule riêng |
| `fetch`/`execute` thiếu timeout | Máy chặn | eslint rule riêng |
| Feature import feature (FE) | Máy chặn | `eslint-plugin-boundaries` |
| `domain/` import framework/vendor SDK | Máy chặn | `dependency-cruiser` |
| Query thiếu `LIMIT` / `SELECT *` | Máy chặn | lint tầng repo |
| Route component > 200 dòng | Máy chặn | `max-lines` |
| `catch` rỗng, nuốt lỗi | Máy chặn | eslint |
| Log chứa key/token | Máy chặn | secret-scan ở logger + CI |
| `any` / `as` ép kiểu | Máy chặn | tsconfig strict + eslint |
| Retry không trần | Máy chặn | chỉ cho phép qua helper duy nhất |
| *Có cách đơn giản hơn không?* | Skill dạy | phán đoán |
| *Abstraction này cần thật không?* | Skill dạy | phán đoán |
| *Business rule hay implementation accident?* | Skill dạy | phán đoán |
| *Traffic tăng 100x thì sao?* | Skill dạy | phán đoán |
| *Contract mới nên là gì?* | Skill dạy | phán đoán |

Skill **chỉ giữ phán đoán**. Phần cơ học đẩy xuống lint/CI, nơi nó không thể bị nguỵ biện.

### 11.3 Skill 1 — `writing-lean-bounded-code`

```yaml
---
name: writing-lean-bounded-code
description: Use when writing or reviewing implementation code that handles
  requests, database access, external APIs, streaming, retries, caching, or
  concurrency — especially when input size, traffic, or fan-out can grow.
---
```

Description **không** tóm tắt quy trình — đó là bẫy `writing-skills` chỉ ra: tóm tắt workflow vào description khiến agent làm theo description mà bỏ qua thân skill.

**Thân SKILL.md — mục tiêu <450 từ**

| Mục | Hình thức | Nội dung |
|---|---|---|
| Overview | 2 câu | *"Minimum code necessary, maximum clarity, bounded resource usage, predictable performance."* + thứ tự ưu tiên: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput |
| Shape of the code | **Công thức khẳng định** | Implementation gồm: guard clause trước → một trách nhiệm mỗi function → business logic tách khỏi I/O → hướng phụ thuộc một chiều |
| Bounded — bắt buộc | **Cấm đoán + bảng** | Mọi workload có thể lớn phải có: concurrency limit · batch · pagination · stream · timeout · retry budget · queue cap · cache TTL+maxsize |
| Rationalization table | Bảng | Lấy verbatim từ baseline test |
| Red flags | List | "Chỉ chạy local nên không cần limit" · "Mảng này chắc không lớn" · "Thêm limit sau" · "Promise.all cho nhanh" |
| Quick reference | Bảng | Triệu chứng → công cụ chặn |

**File tham chiếu:**

| File | Nội dung |
|---|---|
| `bounded-patterns.md` | Mẫu code chạy được: concurrency limiter, retry+backoff có trần, circuit breaker, bounded queue backpressure, cursor pagination, SSE backpressure |
| `review-gate.md` | 12 câu review `rules.md §11` + 10 bước rà trước khi giao |
| `db-checklist.md` | `rules.md §6`: N+1, batch, field thừa, index, LIMIT, transaction dài, query trong loop |

### 11.4 Skill 2 — `porting-behavior-not-code`

```yaml
---
name: porting-behavior-not-code
description: Use when reimplementing a feature that already exists in another
  codebase, migrating a system to a new architecture, or when a reference
  implementation is available and behavior must match but code must not.
---
```

Đặt tên theo insight cốt lõi, không theo dự án — `writing-skills` cấm tạo skill cho quy ước riêng dự án.

**Thân SKILL.md — mục tiêu <450 từ**

| Mục | Hình thức | Nội dung |
|---|---|---|
| Overview | 2 câu | *"Reference tells WHAT. It does not dictate HOW."* + `Understand → Extract rules → Define contract → Design → Implement → Verify parity` |
| Iron law | Cấm đoán | **Không viết code sản phẩm trước khi Feature Matrix của feature đó xong.** Kèm "No exceptions" đóng mọi cửa |
| Business rule vs implementation accident | **Phán đoán — phần giá trị nhất** | Cách phân biệt + 3 nhãn bắt buộc: `REFERENCE_BEHAVIOR` · `SUSPECTED_BUG` · `IMPLEMENTATION_ACCIDENT`. Gặp bug code cũ: **không tái tạo**, gắn nhãn, phân tích, hỏi |
| Parity ≠ code parity | Công thức | 10 function cũ → 3 function mới là **thành công**. Đo ở tầng contract |
| Rationalization table | Bảng | Từ baseline test |
| Red flags | List | "Convert file này sang TS" · "Port class này" · "Giữ vậy vì code cũ làm vậy" · "Đọc tên function là hiểu rồi" |
| DONE gate | Cấu trúc | 13 mục `§29` |

**File tham chiếu:**

| File | Nội dung |
|---|---|
| `feature-matrix.md` | Template 17 cột + 20 câu trace + 12 câu tiền-implement |
| `golden-scenarios.md` | 13 kịch bản `§25` + cách viết contract test cho từng cái |
| `error-taxonomy.md` | 8 mã lỗi + bảng recoverable + luật cấm fallback mù |

### 11.5 Hai skill khớp nhau

```
Feature mới
   │
   ├─ porting-behavior-not-code   →  A · B · C · D   (hiểu → contract → thiết kế)
   │                                      │
   │                                      ▼
   ├─ writing-lean-bounded-code    →  E               (viết code)
   │                                      │
   │                                      ▼
   └─ porting-behavior-not-code    →  F               (parity + DONE gate)
```

`CLAUDE.md` của AIGate nối dây bằng hai dòng, không chép lại nội dung:

```markdown
**REQUIRED SKILL:** `porting-behavior-not-code` — trước mọi feature lấy từ 9router.
**REQUIRED SKILL:** `writing-lean-bounded-code` — trước mọi lần viết code sản phẩm.
```

### 11.6 Iron Law — skill không được viết trước khi có test đỏ

`writing-skills`: *"NO SKILL WITHOUT A FAILING TEST FIRST."* Áp cho cả skill mới lẫn sửa skill.

SP0 **không phải** "viết 2 file markdown". Nó là RED → GREEN → REFACTOR.

**RED — chạy trước khi viết một chữ nào.** Mỗi skill 3+ kịch bản gây áp lực, chạy bằng subagent **không có** skill, ghi lại nguỵ biện **nguyên văn**.

| Skill | Kịch bản áp lực |
|---|---|
| `writing-lean-bounded-code` | (a) "Gấp, nốt hôm nay" + input là mảng connection → xem có `Promise.all` trần trụi không · (b) sunk cost: đã có code load toàn bộ usage vào RAM, bảo tối ưu · (c) uy quyền: "senior bảo cache là được" |
| `porting-behavior-not-code` | (a) đưa 1 file 9router + "port sang TS" → xem có dịch từng dòng không · (b) "feature này đơn giản, code luôn đi" → xem có bỏ Feature Matrix không · (c) đưa `global._*` + "giữ nguyên cho chắc" → xem có nhận ra implementation accident không |

**GREEN** — viết skill nhắm đúng những nguỵ biện đã ghi được. Không thêm nội dung cho tình huống tưởng tượng.

**REFACTOR** — chạy lại; agent tìm cửa mới thì bịt; lặp tới khi kín.

**Micro-test câu chữ** trước khi chạy kịch bản đầy đủ: 5+ lần mỗi biến thể, **luôn có nhánh đối chứng không guidance**, đọc tay từng match. Nếu 5 lần ra 5 kiểu khác nhau thì câu chữ chưa đủ chặt — siết hình thức, không thêm chữ.

### 11.7 SP0 chẻ nhỏ

| Bước | Việc | Xong khi |
|---|---|---|
| SP0.1 | Dựng bộ lint/CI cơ học (bảng §11.2) | Repo mẫu vi phạm → CI đỏ đúng chỗ |
| SP0.2 | RED baseline cho `writing-lean-bounded-code` | Log nguỵ biện nguyên văn, ≥3 kịch bản |
| SP0.3 | GREEN + REFACTOR skill 1 + 3 file tham chiếu | Chạy lại kịch bản → tuân thủ. `wc -w` < 450 |
| SP0.4 | RED baseline cho `porting-behavior-not-code` | như trên |
| SP0.5 | GREEN + REFACTOR skill 2 + 3 file tham chiếu | như trên |
| SP0.6 | Nối vào `CLAUDE.md` AIGate + kiểm tra agent tự tìm ra skill | Agent gặp task lạ tự nạp đúng skill |

SP0.1 đứng trước hai skill, cố ý: mỗi luật mà lint chặn được là một đoạn không phải viết vào skill, và không thể bị nguỵ biện.

---

## 12. Branding

Quét tới tận đáy, không chỉ tên hiển thị:

- tên package npm · CLI binary · tray · service name
- User-Agent gửi lên vendor
- **CN của root CA trong MITM**
- cookie name · schema version marker
- config dir `~/.aigate`
- port mặc định (khác 20128 để chạy song song 9router khi thu tape)
- format API key: giữ tiền tố `sk-` (client mong đợi), phần còn lại thiết kế riêng

---

## 13. Những gì spec này CHƯA quyết

| Mục | Quyết ở đâu |
|---|---|
| Ngưỡng coverage parity cụ thể để coi M2 là xong | Trước khi vào M2 |
| Basic Chat / Media combo / PXPIPE: ship hay xoá | Phase C của feature tương ứng |
| Format API key mới cụ thể | SP6 |
| Port mặc định của AIGate | SP1 |
| Tên package npm và CLI binary | SP1 |
| ~~`drizzle-orm/sqlite-proxy` có gánh nổi `node:sqlite` + `sql.js` không~~ | Đã quyết 2026-09-25: đạt khi có khoá, xem §1.1 |
