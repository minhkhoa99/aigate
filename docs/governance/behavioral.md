# MASTER DIRECTIVE — BEHAVIORAL REIMPLEMENTATION FROM 9ROUTER

## 1. Mục tiêu

Chúng ta đang phát triển một AI Gateway/AI Router MỚI.

Repository tham chiếu:
https://github.com/decolua/9router

QUAN TRỌNG:

9Router KHÔNG phải codebase đích.
9Router KHÔNG phải kiến trúc cần copy.
9Router KHÔNG phải template để port file-by-file.

9Router chỉ đóng vai trò:

REFERENCE IMPLEMENTATION
+
BUSINESS BEHAVIOR REFERENCE
+
FEATURE REFERENCE

Mục tiêu là:

Understand old behavior
    ↓
Extract business rules
    ↓
Extract contracts
    ↓
Extract edge cases
    ↓
Design clean architecture
    ↓
Write NEW implementation
    ↓
Verify behavioral parity


# 2. NGUYÊN TẮC CỐT LÕI

TUYỆT ĐỐI KHÔNG:

- copy nguyên cấu trúc source của 9Router
- rename file rồi coi như implementation mới
- dịch JavaScript sang TypeScript từng dòng
- port class/function 1:1
- giữ technical debt chỉ vì code cũ làm như vậy
- giữ abstraction cũ nếu không còn cần thiết
- giữ naming cũ một cách máy móc
- để business logic phụ thuộc trực tiếp vào framework/vendor
- rewrite trước khi hiểu nghiệp vụ

Phải làm theo:

OLD CODE
    ↓
UNDERSTAND
    ↓
MODEL BEHAVIOR
    ↓
DESIGN
    ↓
NEW CODE


# 3. 9ROUTER LÀ "BEHAVIORAL SOURCE OF TRUTH"

Khi nghiên cứu một feature trong 9Router,
không hỏi:

"File này phải được convert sang code mới như thế nào?"

Mà phải hỏi:

"Tính năng này thực sự đang giải quyết bài toán gì?"

Phải xác định:

1. Trigger của feature là gì?
2. Input là gì?
3. Output là gì?
4. State nào được đọc?
5. State nào bị thay đổi?
6. Business rule nào quyết định behavior?
7. Provider nào tham gia?
8. Có fallback không?
9. Có retry không?
10. Có timeout không?
11. Có quota/rate-limit không?
12. Error được classify như thế nào?
13. Khi partial failure thì chuyện gì xảy ra?
14. Có streaming không?
15. Có cancellation không?
16. Có concurrent processing không?
17. Credentials/token refresh hoạt động ra sao?
18. Data nào cần persist?
19. Data nào chỉ tồn tại runtime?
20. Edge cases là gì?


# 4. KHÔNG CODE NGAY

Trước mỗi module/feature, bắt buộc thực hiện:

PHASE A — DISCOVERY
PHASE B — BEHAVIOR EXTRACTION
PHASE C — CONTRACT DEFINITION
PHASE D — NEW DESIGN
PHASE E — IMPLEMENTATION
PHASE F — PARITY VERIFICATION

Không được bỏ qua A-D để nhảy thẳng vào code.


# 5. FEATURE DISCOVERY

Phải rà soát toàn bộ 9Router để lập Feature Inventory.

Ít nhất phải phân tích các nhóm chức năng:

- Endpoint & API Key
- Providers
- Provider authentication
- OAuth providers
- API-key providers
- Provider account management
- Multi-account
- Model registry
- Model mapping
- Request routing
- Auto fallback
- Combo / Vision Adapter
- Usage
- Quota Tracker
- Token Saver
- CLI Tools
- Media Providers
- Proxy Pools
- Skills
- Console Log
- Remote functionality
- Translation / language functionality
- Settings

Không được chỉ dựa vào menu UI.

Phải tiếp tục trace:

UI
→ API
→ Service
→ business logic
→ persistence
→ provider
→ external request
→ response transformation

để tìm những feature/sub-feature ẩn.


# 6. FEATURE MATRIX

Trước khi implement, tạo bảng:

Feature
Sub-feature
Trigger
Input
Output
Business Rules
State
Dependencies
Provider interaction
Fallback
Error cases
Side effects
Persistence
Performance concerns
Old implementation location
New target module
Parity status

Không feature nào được coi là understood nếu chưa trace đủ luồng.


# 7. TRACE THE BEHAVIOR — KHÔNG CHỈ ĐỌC TÊN FUNCTION

Ví dụ nếu gặp:

routeRequest()

không được kết luận đơn giản:

"Function này route request."

Phải trace sâu:

routeRequest
    ↓
model resolution
    ↓
provider selection
    ↓
account selection
    ↓
quota check
    ↓
credential resolution
    ↓
request translation
    ↓
provider execution
    ↓
stream handling
    ↓
error classification
    ↓
retry/fallback decision
    ↓
usage recording
    ↓
response translation

Nếu một bước gọi function khác,
tiếp tục trace cho tới khi hiểu behavior cuối cùng.


# 8. BUSINESS RULE > OLD IMPLEMENTATION

Ví dụ code cũ có:

if provider A error 429
    try account B
if account B exhausted
    try provider C

Không được copy nguyên if/else.

Trước tiên phải rút ra business rule:

"On a recoverable quota/rate-limit failure,
attempt another eligible account/provider
according to routing policy."

Sau đó thiết kế implementation mới phù hợp kiến trúc hiện tại.


# 9. XÂY DOMAIN MODEL MỚI

Business concepts phải được model rõ ràng.

Ví dụ:

Provider
ProviderAccount
Model
ModelCapability
Credential
Quota
Usage
RoutingPolicy
FallbackPolicy
Request
Response
Stream
TokenUsage
Proxy
MediaProvider
Skill

Không để domain concepts bị rải rác dưới dạng:

string
object
if/else
magic constants.


# 10. ARCHITECTURE MỚI KHÔNG PHỤ THUỘC 9ROUTER

Kiến trúc target phải được thiết kế độc lập.

Ví dụ:

┌────────────────────────────┐
│ API / Controller           │
└────────────┬───────────────┘
             ↓
┌────────────────────────────┐
│ Application                │
│                            │
│ RouteRequestUseCase        │
│ ProviderUseCase            │
│ QuotaUseCase               │
│ UsageUseCase               │
└────────────┬───────────────┘
             ↓
┌────────────────────────────┐
│ Domain                     │
│                            │
│ routing policies           │
│ quota policies             │
│ provider concepts          │
└────────────┬───────────────┘
             ↓
          PORTS
             ↓
┌────────────────────────────┐
│ Infrastructure             │
│                            │
│ OpenAIAdapter              │
│ AnthropicAdapter           │
│ GeminiAdapter              │
│ RedisAdapter               │
│ DatabaseAdapter            │
└────────────────────────────┘


# 11. PROVIDER PHẢI QUA PORT

Business/Application layer không được phụ thuộc trực tiếp vào:

OpenAI SDK
Anthropic SDK
Gemini SDK
9Router
database client
Redis client

Ví dụ:

interface AIProviderPort {
    execute(...)
    stream(...)
    getModels(...)
    validateCredential(...)
}

Sau đó:

OpenAIAdapter
AnthropicAdapter
GeminiAdapter
ClaudeCodeAdapter
CodexAdapter

implement port.


# 12. ROUTER PHẢI LÀ BUSINESS ENGINE RIÊNG

Không nhét routing logic vào controller.

Sai:

Controller
  → provider
  → fallback
  → quota
  → retry

Đúng:

Controller
    ↓
RouteRequestUseCase
    ↓
RoutingEngine
    ↓
RoutingPolicy
    ↓
ProviderPort


RoutingEngine chịu trách nhiệm quyết định.

Provider Adapter chịu trách nhiệm giao tiếp vendor.

Hai concern không được trộn.


# 13. TRANSLATOR / PROTOCOL

Phải phân biệt:

Canonical Internal Protocol

với:

OpenAI protocol
Anthropic protocol
Gemini protocol
vendor-specific protocol

Flow ưu tiên:

Incoming request
        ↓
Protocol Adapter
        ↓
Canonical Request
        ↓
Routing Engine
        ↓
Provider Adapter
        ↓
Vendor Request

Response:

Vendor Response
        ↓
Provider Adapter
        ↓
Canonical Response
        ↓
Protocol Adapter
        ↓
Client Response

Không để routing engine phải hiểu mọi vendor format.


# 14. FEATURE PARITY KHÔNG CÓ NGHĨA CODE PARITY

Mục tiêu:

same useful behavior

KHÔNG phải:

same functions
same files
same classes
same architecture

Có thể:

9Router cần 10 functions

nhưng implementation mới chỉ cần 3 functions.

Nếu behavior vẫn chính xác,
implementation mới đơn giản hơn được ưu tiên.


# 15. CODE QUALITY

Code mới phải:

LEAN
clear
strongly typed
testable
maintainable
low coupling
high cohesion

Ưu tiên:

Shortest clear implementation

KHÔNG phải:

Shortest possible implementation.


# 16. PERFORMANCE

Không được kế thừa performance issue từ code cũ.

Kiểm tra:

- unbounded Promise.all
- N+1 query
- unnecessary serialization
- excessive object allocation
- repeated model lookup
- repeated credential lookup
- unnecessary network call
- blocking event loop
- unbounded queue
- unbounded retry
- large in-memory dataset
- duplicated transformations


Mọi workload có khả năng lớn phải BOUNDED.

Sử dụng khi phù hợp:

concurrency limit
batch
stream
pagination
timeout
retry budget
connection pooling
backpressure
cache


# 17. LATENCY

Với request path:

Client
→ Gateway
→ Routing
→ Provider
→ Client

phải đặc biệt tối ưu hot path.

Không thêm abstraction làm phát sinh network/database I/O
chỉ vì muốn "clean architecture".

Architecture phải clean,
nhưng runtime path phải lean.


# 18. STREAMING

Streaming phải được coi là first-class behavior.

Không được:

buffer toàn bộ response rồi mới trả.

Phải preserve:

TTFT
SSE/chunk flow
cancellation
backpressure
disconnect handling
provider errors.


# 19. FALLBACK ENGINE

Fallback phải là explicit policy.

Ví dụ:

request
   ↓
candidate resolver
   ↓
Provider A / account 1
   │
   ├ success → return
   │
   └ recoverable failure
          ↓
Provider A / account 2
          │
          └ failure
               ↓
Provider B

Không dùng nested try/catch khó maintain.


Phải classify error:

AUTH_ERROR
RATE_LIMIT
QUOTA_EXHAUSTED
PROVIDER_UNAVAILABLE
TIMEOUT
INVALID_REQUEST
MODEL_UNAVAILABLE
INTERNAL_ERROR

Chỉ recoverable error mới được fallback.


# 20. KHÔNG FALLBACK MÙ QUÁNG

Ví dụ:

400 malformed request

không được thử:

provider A
provider B
provider C
provider D

nếu bản thân request đã invalid.

Fallback phải dựa trên error semantics.


# 21. QUOTA

Phải hiểu đầy đủ:

quota source
quota refresh
reset time
remaining
account quota
provider quota
model quota
subscription quota
budget

Không chỉ copy UI Quota Tracker.


# 22. USAGE

Phải trace:

request
→ selected provider
→ selected account
→ model
→ input token
→ output token
→ cached token
→ cost
→ latency
→ status
→ error
→ fallback attempts

để xây usage model mới.


# 23. OBSERVABILITY

Mỗi request nên có:

requestId
traceId
provider
account
model
attempt
latency
TTFT
token usage
fallback reason
final status

Nhưng tuyệt đối không log:

API key
access token
refresh token
secret.


# 24. TESTING STRATEGY

Trước khi thay một behavior,
tạo characterization/contract tests khi khả thi.

Test phải chứng minh:

OLD BEHAVIOR
≈
NEW BEHAVIOR

ở contract level.

Không test implementation details.


Ví dụ:

given quota exhausted on account A

OLD:
→ choose account B

NEW:
→ choose account B

PASS


Không yêu cầu:

OLD calls function X
NEW calls function X.


# 25. GOLDEN SCENARIOS

Phải tạo scenario test cho các flow quan trọng:

normal completion
stream completion
provider timeout
rate limit
quota exhausted
invalid credentials
token refresh
account failover
provider fallback
client cancellation
partial stream failure
model unavailable
all providers unavailable


# 26. KHI CODE CŨ CÓ BUG

Không tự động reproduce bug.

Đánh dấu:

REFERENCE_BEHAVIOR
SUSPECTED_BUG

Phân tích:

expected behavior
actual behavior
impact

Sau đó chỉ implement behavior hợp lý
sau khi xác nhận.


# 27. KHI CODE CŨ CÓ TECHNICAL DEBT

Không mang technical debt sang hệ thống mới.

Phải phân biệt:

BUSINESS REQUIREMENT

với

IMPLEMENTATION ACCIDENT.


Ví dụ:

Code cũ dùng global mutable map

không có nghĩa:

global mutable map là business requirement.


# 28. QUY TRÌNH CHO MỖI FEATURE

Mỗi feature phải đi qua:

DISCOVER
    ↓
TRACE
    ↓
DOCUMENT
    ↓
EXTRACT RULES
    ↓
DEFINE CONTRACT
    ↓
DESIGN NEW
    ↓
IMPLEMENT
    ↓
TEST
    ↓
COMPARE
    ↓
REVIEW


# 29. KHÔNG ĐƯỢC TỰ ĐÁNH DẤU "DONE"

Một feature chỉ sẵn sàng review khi:

[ ] Feature inventory complete
[ ] Business flow documented
[ ] Edge cases identified
[ ] Contract defined
[ ] New design reviewed
[ ] Implementation completed
[ ] Unit tests passed
[ ] Contract tests passed
[ ] Error cases tested
[ ] Streaming tested if applicable
[ ] Performance risks checked
[ ] Security checked
[ ] Behavioral parity checked

Nếu thiếu bất kỳ mục nào:

status != DONE


# 30. TRƯỚC KHI IMPLEMENT BẤT KỲ FEATURE NÀO

Hãy trả lời trước:

1. Feature này làm gì trong 9Router?
2. User-visible behavior là gì?
3. Business rules là gì?
4. Luồng execution thực tế là gì?
5. Những source files nào chứng minh điều đó?
6. Các edge cases là gì?
7. Phần nào là business logic?
8. Phần nào chỉ là implementation detail của 9Router?
9. Contract mới nên là gì?
10. Kiến trúc mới implement nó như thế nào?
11. Có cách nào đơn giản hơn implementation cũ không?
12. Test nào chứng minh parity?


CHỈ SAU KHI HOÀN THÀNH PHÂN TÍCH NÀY
MỚI ĐƯỢC VIẾT CODE.


# FINAL PRINCIPLE

9Router tells us:

WHAT the system should do.

It does NOT dictate:

HOW our new system must be written.


Do not port the old code.

Extract its knowledge.

Then engineer the new system.
