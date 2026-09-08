"""Default timing configuration.

Every value can be overridden by an environment variable, and again per job
through the API. Ranges are (min, max) in seconds / number of forms.
"""

from __future__ import annotations

import os


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


# 1. Khoảng nghỉ ngẫu nhiên giữa 2 form liên tiếp trong cùng đợt (giây)
DEFAULT_DELAY_BETWEEN_FORMS: tuple[float, float] = (
    _env_float("AUTOFILL_DELAY_MIN", 1.5),
    _env_float("AUTOFILL_DELAY_MAX", 4.0),
)

# 2. Số lượng form ngẫu nhiên trong mỗi đợt gửi
DEFAULT_BATCH_SIZE_RANGE: tuple[int, int] = (
    _env_int("AUTOFILL_BATCH_MIN", 3),
    _env_int("AUTOFILL_BATCH_MAX", 8),
)

# 3. Thời gian nghỉ ngơi ngẫu nhiên giữa các đợt gửi (giây)
DEFAULT_PAUSE_BETWEEN_BATCHES: tuple[float, float] = (
    _env_float("AUTOFILL_PAUSE_MIN", 20.0),
    _env_float("AUTOFILL_PAUSE_MAX", 60.0),
)

# HTTP
REQUEST_TIMEOUT: float = _env_float("AUTOFILL_REQUEST_TIMEOUT", 15.0)
USER_AGENT: str = os.getenv(
    "AUTOFILL_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
)

# Số job đã hoàn thành được giữ lại trong bộ nhớ
MAX_FINISHED_JOBS: int = _env_int("AUTOFILL_MAX_FINISHED_JOBS", 50)
# Số payload mẫu lưu lại cho mỗi job (để xem trước / debug)
MAX_STORED_PAYLOADS: int = _env_int("AUTOFILL_MAX_STORED_PAYLOADS", 20)
