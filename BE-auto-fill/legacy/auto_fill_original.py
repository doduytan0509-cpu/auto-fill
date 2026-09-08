"""Script gốc (chạy độc lập, không dùng API). Giữ lại để tham khảo.

Phiên bản API nằm trong thư mục ``app/`` (FastAPI).
"""

import openpyxl
import requests
import time
import random
import sys
from tqdm import tqdm

# Thiết lập encoding UTF-8 cho console Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# ==============================================================================
# CẤU HÌNH THỜI GIAN VÀ SỐ LƯỢNG GỬI NGẪU NHIÊN (Bạn có thể tùy chỉnh)
# ==============================================================================
# 1. Khoảng nghỉ ngẫu nhiên giữa 2 form liên tiếp trong cùng đợt (giây)
DELAY_BETWEEN_FORMS = (1.5, 4.0)
# 2. Số lượng form ngẫu nhiên trong mỗi đợt gửi (ví dụ: mỗi đợt gửi từ 3 đến 8 form)
BATCH_SIZE_RANGE = (3, 8)
# 3. Thời gian nghỉ ngơi ngẫu nhiên giữa các đợt gửi (giây) (ví dụ: nghỉ 20s đến 60s)
PAUSE_BETWEEN_BATCHES = (20, 60)
# ==============================================================================

# 1. Đường dẫn submit của Form
FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdeQtCo9W86RAKTod-qBPda2NSVOVY9ZHTtW4ZyqW1mbcBtbg/formResponse"

# 2. Danh sách 50 mã entry tương ứng từ cột 0 đến cột 49 của file Excel
ENTRY_LIST = [
    "entry.1312026164", "entry.1260632264", "entry.565455947", "entry.1633546942", "entry.37768034",
    "entry.614855320", "entry.1069416529", "entry.601395773", "entry.1387405317", "entry.845751334",
    "entry.804011944", "entry.891618024", "entry.1984900154", "entry.568015951", "entry.530320512",
    "entry.531457778", "entry.911360382", "entry.609584387", "entry.2032069430", "entry.1710652141",
    "entry.11427864", "entry.1241325430", "entry.1989703662", "entry.1164818072", "entry.2144284697",
    "entry.870766696", "entry.1699167886", "entry.1640489740", "entry.434494689", "entry.1929332398",
    "entry.348986365", "entry.1549420888", "entry.1971450284", "entry.1324082839", "entry.1379272115",
    "entry.428706828", "entry.105468150", "entry.2077891042", "entry.1129826507", "entry.1794465737",
    "entry.267575104", "entry.1626999858", "entry.1728778797", "entry.352708637", "entry.1817215641",
    "entry.353373241", "entry.1179493503", "entry.600424567", "entry.1921857530", "entry.2055154999"
]

# 3. Đọc dữ liệu từ sheet 'Coded' (chứa đúng các mã số 1, 2, 3... tương thích với Google Form)
EXCEL_FILE = "official_636_synthetic_responses_revised_realistic.xlsx"
wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
sheet = wb["Coded"]

# Lấy dữ liệu các dòng
rows = list(sheet.iter_rows(values_only=True))
if not rows:
    raise ValueError("Sheet không có dữ liệu!")

header = rows[0]
data_rows = rows[1:]

print(f"Tổng số dòng cần điền: {len(data_rows)}")
print(f"Số cột trong file: {len(header)}")

if len(ENTRY_LIST) != len(header):
    print(f"Lưu ý: Số mã entry ({len(ENTRY_LIST)}) chưa khớp với số cột ({len(header)}). Vui lòng kiểm tra lại.")

# 4. Thiết lập Session để tối ưu kết nối
session = requests.Session()
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://docs.google.com/forms/d/e/1FAIpQLSdeQtCo9W86RAKTod-qBPda2NSVOVY9ZHTtW4ZyqW1mbcBtbg/viewform"
}

success_count = 0
fail_count = 0

# Khởi tạo kích thước đợt đầu tiên
current_batch_target = random.randint(*BATCH_SIZE_RANGE)
batch_counter = 0

print(f"Bắt đầu gửi đợt 1 (gồm {current_batch_target} form)...")

# 5. Vòng lặp gửi từng dòng dữ liệu
for index, row in enumerate(tqdm(data_rows, desc="Đang gửi dữ liệu")):
    payload = {}
    for col_idx, entry_id in enumerate(ENTRY_LIST):
        if col_idx < len(row):
            val = row[col_idx]
            # Bỏ qua ô trống / None / chuỗi rỗng / nan
            if val is None or str(val).strip() == "" or str(val).strip().lower() == "nan":
                continue
            if isinstance(val, float) and val.is_integer():
                val = int(val)
            payload[entry_id] = str(val).strip()

    # Xác định luồng di chuyển qua các trang (pageHistory) cho từng dòng
    s1_val = str(row[0]).strip() if len(row) > 0 and row[0] is not None else "1"
    s2_val = str(row[1]).strip() if len(row) > 1 and row[1] is not None else "1"
    c5_val = str(row[21]).strip() if len(row) > 21 and row[21] is not None else "1"

    if s1_val == "2":
        # Từ chối tham gia ngay từ trang 0
        payload["pageHistory"] = "0"
    elif s2_val == "2":
        # Không đủ điều kiện khảo sát (dừng ở trang 1)
        payload["pageHistory"] = "0,1"
    else:
        # Người tham gia hợp lệ:
        if c5_val in ["1", "2"]:
            # Đi qua toàn bộ các trang (0 -> 9, bao gồm nhánh ASO trang 6)
            payload["pageHistory"] = "0,1,2,3,4,5,6,7,8,9"
        else:
            # Bỏ qua nhánh ASO trang 6, nhảy thẳng từ trang 5 sang trang 7
            payload["pageHistory"] = "0,1,2,3,4,5,7,8,9"

    try:
        response = session.post(FORM_URL, data=payload, headers=headers, timeout=10)
        # Mã 200: Google Form đã nhận câu trả lời thành công
        if response.status_code == 200:
            success_count += 1
        else:
            fail_count += 1
            tqdm.write(f"Dòng {index + 1} lỗi mã trạng thái: {response.status_code}")
    except Exception as e:
        fail_count += 1
        tqdm.write(f"Dòng {index + 1} gặp sự cố: {e}")

    batch_counter += 1

    # Kiểm tra nếu chưa phải dòng cuối cùng
    if index < len(data_rows) - 1:
        # Nếu đã hoàn thành số lượng form của đợt hiện tại -> Nghỉ khoảng thời gian dài hơn
        if batch_counter >= current_batch_target:
            pause_time = round(random.uniform(*PAUSE_BETWEEN_BATCHES), 1)
            current_batch_target = random.randint(*BATCH_SIZE_RANGE)
            batch_counter = 0
            tqdm.write(f"\n☕ Đã gửi xong một đợt. Tạm nghỉ {pause_time}s... Đợt tiếp theo sẽ gửi {current_batch_target} form.")
            time.sleep(pause_time)
        else:
            # Khoảng nghỉ ngắn ngẫu nhiên giữa 2 form trong cùng 1 đợt
            delay = round(random.uniform(*DELAY_BETWEEN_FORMS), 1)
            time.sleep(delay)

print("\n--- HOÀN TẤT ---")
print(f"Thành công: {success_count}/{len(data_rows)}")
print(f"Thất bại: {fail_count}/{len(data_rows)}")
