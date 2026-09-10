# Auto Fill Google Forms API

API (FastAPI) tự động điền Google Form từ file Excel. Đây là bản viết lại của
script gốc (`legacy/auto_fill_original.py`) với các chức năng:

| Chức năng | Script gốc | API |
|-----------|-----------|-----|
| `FORM_URL` | Sửa trong code | Nhập qua tham số `form_url` |
| `ENTRY_LIST` | Gõ tay 50 mã entry | **Tự động** lấy từ form (`POST /form/inspect`) |
| File Excel | Đường dẫn cố định | **Upload** file qua API |
| `DELAY_BETWEEN_FORMS` | Sửa trong code | `delay_min` / `delay_max` |
| `BATCH_SIZE_RANGE` | Sửa trong code | `batch_min` / `batch_max` |
| `PAUSE_BETWEEN_BATCHES` | Sửa trong code | `pause_min` / `pause_max` |
| Theo dõi tiến độ | tqdm trên console | `GET /jobs/{job_id}` |
| Huỷ giữa chừng | Ctrl+C | `POST /jobs/{job_id}/cancel` |

## Cài đặt & chạy

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Mở <http://127.0.0.1:8000/docs> để dùng giao diện Swagger (có nút upload file).

## Quy trình sử dụng

### 1. Lấy ENTRY_LIST từ FORM_URL

```bash
curl -X POST http://127.0.0.1:8000/form/inspect \
  -H "Content-Type: application/json" \
  -d '{"form_url": "https://docs.google.com/forms/d/e/<ID>/viewform"}'
```

Chấp nhận mọi dạng link: `.../viewform`, `.../formResponse`, link `edit`.
Kết quả trả về `entry_list` (theo đúng thứ tự câu hỏi trên form), số trang,
`default_page_history`, và chi tiết từng câu hỏi (loại, lựa chọn, bắt buộc hay không).

### 2. Kiểm tra file Excel

```bash
curl -X POST http://127.0.0.1:8000/excel/preview \
  -F "file=@du_lieu.xlsx" -F "sheet_name=Coded" -F "limit=3"
```

Mặc định đọc sheet **`Coded`** nếu có, không thì sheet đầu tiên. Dòng 1 là tiêu đề.

### 3. Xem trước payload (không gửi)

```bash
curl -X POST http://127.0.0.1:8000/jobs/preview \
  -F "file=@du_lieu.xlsx" \
  -F "form_url=https://docs.google.com/forms/d/e/<ID>/viewform" \
  -F "limit=2"
```

Trả về mapping *cột → entry*, cảnh báo (nếu số cột không khớp số entry) và payload của vài dòng đầu.

### 4. Tạo job gửi form

```bash
curl -X POST http://127.0.0.1:8000/jobs \
  -F "file=@du_lieu.xlsx" \
  -F "form_url=https://docs.google.com/forms/d/e/<ID>/viewform" \
  -F "sheet_name=Coded" \
  -F "delay_min=1.5" -F "delay_max=4" \
  -F "batch_min=3"   -F "batch_max=8" \
  -F "pause_min=20"  -F "pause_max=60"
```

Trả về `job_id`. Job chạy nền; theo dõi bằng:

```bash
curl http://127.0.0.1:8000/jobs/<job_id>        # tiến độ, success/failed, log
curl -X POST http://127.0.0.1:8000/jobs/<job_id>/cancel
```

## Tham số của `POST /jobs`

| Tham số | Mặc định | Ý nghĩa |
|---------|----------|---------|
| `file` | *(bắt buộc)* | File Excel `.xlsx` |
| `form_url` | *(bắt buộc)* | Link Google Form |
| `sheet_name` | `Coded` / sheet đầu | Sheet chứa dữ liệu |
| `header_row` | `1` | Dòng tiêu đề |
| `delay_min`, `delay_max` | `1.5`, `4.0` | **DELAY_BETWEEN_FORMS** – nghỉ giữa 2 form trong cùng đợt (giây) |
| `batch_min`, `batch_max` | `3`, `8` | **BATCH_SIZE_RANGE** – số form mỗi đợt |
| `pause_min`, `pause_max` | `20`, `60` | **PAUSE_BETWEEN_BATCHES** – nghỉ giữa các đợt (giây) |
| `mapping_mode` | `position` | `position`: cột thứ *i* → entry thứ *i* (như script gốc). `header`: tên cột là `entry.<id>` hoặc tiêu đề câu hỏi |
| `entry_list` | *(tự động)* | Ghi đè ENTRY_LIST: JSON array hoặc chuỗi cách nhau bằng dấu phẩy |
| `page_history` | `auto` | `auto` = đi qua tất cả các trang; `none` = không gửi; hoặc chuỗi cố định `0,1,2` |
| `checkbox_delimiter` | `;` | Ký tự tách nhiều lựa chọn trong ô của câu hỏi checkbox |
| `start_row` | `1` | Dòng dữ liệu bắt đầu (1 = dòng đầu sau tiêu đề) |
| `max_rows` | *(hết)* | Giới hạn số dòng |
| `dry_run` | `false` | Chỉ tạo payload, không gửi (xem tại `GET /jobs/{id}/payloads`) |
| `stop_on_error` | `false` | Dừng job khi có dòng lỗi |

### Cột đặc biệt trong Excel

* Cột tên **`pageHistory`**: giá trị của cột này được dùng làm `pageHistory` cho từng dòng
  (thay cho `page_history` chung). Dùng khi form có rẽ nhánh như script gốc
  (`0`, `0,1`, `0,1,2,3,4,5,7,8,9`...). Cột này không tính vào mapping theo vị trí.
* Cột tên **`emailAddress`**: gửi kèm nếu form thu thập email.

### Giá trị ô

* Ô trống / `nan` bị bỏ qua (không gửi).
* Số thực nguyên (`2.0`) → `2`.
* Câu hỏi checkbox: `A;B;C` → gửi 3 lựa chọn.
* Ngày → `YYYY-MM-DD`, giờ → `HH:MM`.

## Biến môi trường (giá trị mặc định)

| Biến | Mặc định |
|------|----------|
| `AUTOFILL_DELAY_MIN` / `AUTOFILL_DELAY_MAX` | `1.5` / `4.0` |
| `AUTOFILL_BATCH_MIN` / `AUTOFILL_BATCH_MAX` | `3` / `8` |
| `AUTOFILL_PAUSE_MIN` / `AUTOFILL_PAUSE_MAX` | `20` / `60` |
| `AUTOFILL_REQUEST_TIMEOUT` | `15` |
| `AUTOFILL_USER_AGENT` | Chrome trên Windows |

## Danh sách endpoint

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health` | Kiểm tra server |
| GET | `/config/defaults` | 3 mức thời gian mặc định |
| GET | `/form/urls?form_url=` | Chuẩn hoá link → viewform / formResponse |
| POST | `/form/inspect` | Lấy ENTRY_LIST + thông tin câu hỏi từ FORM_URL |
| POST | `/excel/preview` | Upload Excel, xem tiêu đề và dữ liệu mẫu |
| POST | `/jobs/preview` | Xem mapping và payload, không gửi |
| POST | `/jobs` | Tạo job gửi form (chạy nền) |
| GET | `/jobs` | Danh sách job |
| GET | `/jobs/{id}` | Trạng thái, tiến độ, log |
| GET | `/jobs/{id}/payloads` | Payload đã tạo |
| POST | `/jobs/{id}/pause` | Tạm dừng job đang chạy |
| POST | `/jobs/{id}/resume` | Tiếp tục job đang tạm dừng |
| POST | `/jobs/{id}/cancel` | Huỷ job |
| DELETE | `/jobs/{id}` | Xoá job đã kết thúc |

## Chạy test

```bash
pip install -r requirements-dev.txt
pytest
```

## Cấu trúc

```
app/
  main.py          # FastAPI endpoints
  google_form.py   # Chuẩn hoá URL, tải form, tách ENTRY_LIST từ FB_PUBLIC_LOAD_DATA_
  excel_reader.py  # Đọc file Excel upload
  runner.py        # Job chạy nền: mapping cột, tạo payload, gửi theo đợt
  models.py        # Pydantic models (TimingConfig, JobOptions, JobStatus)
  config.py        # Giá trị mặc định / biến môi trường
legacy/
  auto_fill_original.py   # Script gốc
tests/
```

## Lưu ý

* Job được lưu trong bộ nhớ; khởi động lại server sẽ mất danh sách job.
* Chỉ dùng với form mà bạn có quyền gửi dữ liệu.
