# Auto Fill Google Forms - Frontend (React + Vite)

Giao diện Web hiện đại, trực quan và chuyên nghiệp kết nối trực tiếp với Backend API (`BE-auto-fill`) để tự động hoá toàn bộ quy trình điền Google Form từ file Excel.

## 🚀 Các tính năng chính

1. **AutoFill Studio (Quy trình 4 bước hoàn chỉnh)**:
   - **Bước 1**: Nhập URL Google Form → Tự động phân tích, trích xuất toàn bộ câu hỏi và mã `entry.<id>`.
   - **Bước 2**: Kéo thả file Excel (`.xlsx` / `.xlsm`), chọn Sheet dữ liệu và xem trước các dòng đầu.
   - **Bước 3**: Cấu hình 3 dải thời gian ngẫu nhiên (Delay giữa các form, Kích thước đợt, Thời gian nghỉ giữa các đợt), chọn chế độ ánh xạ cột (`position` hoặc `header`), tùy chọn `dry_run` (chạy thử không gửi) và `stop_on_error`.
   - **Bước 4**: Xem trước bảng ánh xạ cột → entry và các payload mẫu được tạo ra, sau đó 1-click khởi chạy job.

2. **Form Inspector (Công cụ khảo sát Form)**:
   - Phân tích chi tiết bất kỳ link Google Form nào.
   - Hiển thị danh sách câu hỏi, loại câu hỏi (Trắc nghiệm, Hộp kiểm, Đoạn văn, Thang đo, Lưới trắc nghiệm...), tùy chọn lựa chọn và sao chép mã entry / danh sách JSON.

3. **Excel Viewer (Công cụ kiểm tra Excel)**:
   - Soi và kiểm tra cấu trúc dữ liệu file Excel.
   - Chuyển đổi qua lại giữa các sheet linh hoạt, điều chỉnh dòng tiêu đề.

4. **Job Monitor & Dashboard (Quản lý & Giám sát thời gian thực)**:
   - Theo dõi tiến độ thời gian thực (đếm số form thành công / thất bại / còn lại).
   - Ticker hành động tiếp theo (đếm giây nghỉ hoặc dòng đang gửi).
   - Nhật ký Logs phong cách Terminal tự động cuộn (auto-scroll) và có bộ lọc tìm kiếm.
   - Danh sách dòng lỗi và nguyên nhân chi tiết.
   - Xem các payload thực tế đã sinh và sao chép JSON.
   - Nút Huỷ Job và Xoá Job.

## 🛠️ Hướng dẫn cài đặt & khởi chạy

### 1. Khởi chạy Backend (`BE-auto-fill`)
```bash
cd d:\FALL26\auto-fill\BE-auto-fill
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend sẽ hoạt động tại: `http://127.0.0.1:8000` (Swagger docs tại: `http://127.0.0.1:8000/docs`).

### 2. Khởi chạy Frontend (`FE-auto-fill`)
```bash
cd d:\FALL26\auto-fill\FE-auto-fill\my-react-app
npm run dev
```
Mở trình duyệt tại: `http://localhost:5173`.
