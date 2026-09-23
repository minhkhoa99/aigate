# AIGate — Stitch output audit

Chạy checklist "After Stitch generates" của `stitch-briefs.md` trên 27 màn của
project Stitch **AIGate — Dashboard** (`1404614991941393773`).

Bằng chứng: HTML + ảnh tải về `docs/design/stitch-export/{html,shot}/`,
script kiểm ở `stitch-export/audit.py`.

Kết luận: **nội dung từng màn bám brief tốt; hai lỗi hệ thống cần sửa trước khi
đưa vào U0/U1 — sidebar không đồng nhất, và gần như chỉ vẽ happy path.**

---

## 1 · Credential / key / token — PASS

Quét toàn bộ 27 file HTML với mẫu `sk-*`, `ghp_*`, JWT `eyJ*`, `AIza*`,
`Bearer <token>`, private key block. Đúng 2 kết quả, cả hai hợp lệ:

| Màn | Chuỗi | Ngữ cảnh | Kết luận |
|---|---|---|---|
| `endpoint-keys` | `sk-proj-9f8a…` | nằm trong create-key drawer, kèm dòng "This key will not be shown again. Copy it now." | Đúng brief §4 (hiện đúng một lần) |
| `authflow-modals` | `sk-ant-api03-xxxx…92A` | đã mask, nhãn "Stored encrypted" | Đúng |

Bảng API keys ở `endpoint-keys` chỉ render dạng rút gọn. `request-detail` —
màn brief cấm tuyệt đối — sạch: chỉ có request id, trace id, model, attempt.

## 2 · Sidebar đồng nhất — FAIL (nghiêm trọng)

Brief: sidebar **giống hệt trên mọi màn**, "No other item is ever hidden".

Thực tế chỉ **1/25 màn trong shell** render đủ:

| Nhóm | Màn | Tình trạng sidebar |
|---|---|---|
| Đúng | `overview` | Đủ 7 nhóm + toàn bộ sub-item (kể cả Console) |
| Sai — thu gọn | 23 màn còn lại trong shell | Chỉ render nhãn nhóm cấp 1 (Overview · Gateway · Providers · Traffic · Network · Integrations · Settings), ẩn hết sub-item |
| ~~Sai — lệch hẳn~~ **đã sửa** | `settings-auth` | Bản đầu có sidebar khác hoàn toàn (**Dashboard · Proxies · Models · Settings · Logs · Docs · Support**). Đã regenerate: `settings-auth-v2` nay đủ 7 nhóm + sub-item, "Auth & Access" active, thêm error block `ERR_AUTH_CREDENTIAL_MISMATCH` + nút Retry, OIDC/SAML dùng pill "configured" + Replace. Còn sót: brand vẫn ghi "AIGate Node / Local Instance" thay vì "AIGate" |
| Không áp dụng | `login-callback`, `onboarding` | Đúng: brief quy định nằm ngoài shell |

Đây là lỗi làm hỏng mục tiêu "shell dùng chung" của sub-project U1: nếu lấy
markup này làm nguồn, mỗi màn sẽ đẻ ra một sidebar riêng.

**Cách sửa rẻ nhất:** không regenerate 24 màn. Lấy sidebar của `overview` làm
component chuẩn duy nhất trong U1, các màn còn lại chỉ dùng phần content.
Riêng `settings-auth` phải regenerate vì cả layout settings shell cũng lệch.

## 3 · State rules (§10.7) — FAIL (chỉ vẽ happy path)

| Trạng thái | Số màn có | Ghi chú |
|---|---|---|
| Loading skeleton | 10/27 | `authflow-modals`, `connections`, `console`, `deploy-wizard`, `llm-providers`, `login-callback`, `onboarding`, `provider-detail`, `request-detail`, `tunnel` |
| Empty state | 1/27 | Gần như không màn nào có. `overview` **thiếu** empty state "No traffic yet" dù brief mô tả rõ |
| Error + retry | 4/27 | `authflow-modals`, `deploy-wizard`, `login-callback`, `routing-fallback` |

Đúng như brief cảnh báo ("Stitch tends to draw only the happy path"). Các màn
bảng chính (`requests`, `usage`, `quota`, `mcp`, `skills`, `proxy-pools`) không
có bất kỳ biến thể trạng thái nào.

**Cách sửa:** không cần regenerate từng màn. Định nghĩa 3 component dùng chung
trong U0 (`<Skeleton>`, `<EmptyState cause action>`, `<ErrorState code message
onRetry>`) rồi áp vào mọi lane. Dùng bản Stitch của `deploy-wizard` /
`login-callback` làm mẫu thị giác cho error, `connections` cho skeleton.

## 4 · Lệch brief khác (mức thấp, ghi để sửa ở U1+)

| Màn | Vấn đề |
|---|---|
| `mitm` | 3 nút Generate CA / Install CA / Remove CA đặt **sát nhau**; brief yêu cầu cách xa để không bấm nhầm. Modal type-to-confirm không được render |
| `overview` | Sidebar hiện "Console" mặc định; brief: chỉ hiện khi Developer mode bật |
| `settings-auth` | Ngoài sidebar lệch, cần kiểm lại phần OIDC/SAML dùng pill "configured" + nút Replace thay vì ô nhập secret |
| `routing-fallback` | Gộp cả 4 tab vào một màn cao 3886px thay vì tách; chấp nhận được ở giai đoạn design, không bê nguyên sang code |
| `login-callback`, `deploy-wizard`, `authflow-modals` | Là màn "showcase" ghép nhiều panel/biến thể, không phải một route thật |

---

## Việc cần làm trước khi vào U0/U1

1. ~~Regenerate `settings-auth`~~ — xong, dùng bản `settings-auth-v2`; xoá bản cũ khỏi project Stitch.
2. Chốt sidebar của `overview` là nguồn duy nhất cho U1; bỏ qua sidebar 23 màn còn lại.
3. Dựng `<Skeleton>` / `<EmptyState>` / `<ErrorState>` trong U0 rồi áp toàn bộ lane — đừng chờ Stitch vẽ.
4. Sửa khoảng cách 3 nút CA và bổ sung modal type-to-confirm ở MITM khi code.
5. Ẩn Console khỏi sidebar khi Developer mode tắt.
