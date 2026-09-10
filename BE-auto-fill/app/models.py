"""Pydantic models shared by the API layer."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from . import config


class TimingConfig(BaseModel):
    """The three tunable timing ranges of the original script."""

    # 1. Khoảng nghỉ ngẫu nhiên giữa 2 form liên tiếp trong cùng đợt (giây)
    delay_min: float = Field(config.DEFAULT_DELAY_BETWEEN_FORMS[0], ge=0)
    delay_max: float = Field(config.DEFAULT_DELAY_BETWEEN_FORMS[1], ge=0)
    # 2. Số lượng form ngẫu nhiên trong mỗi đợt gửi
    batch_min: int = Field(config.DEFAULT_BATCH_SIZE_RANGE[0], ge=1)
    batch_max: int = Field(config.DEFAULT_BATCH_SIZE_RANGE[1], ge=1)
    # 3. Thời gian nghỉ ngơi ngẫu nhiên giữa các đợt gửi (giây)
    pause_min: float = Field(config.DEFAULT_PAUSE_BETWEEN_BATCHES[0], ge=0)
    pause_max: float = Field(config.DEFAULT_PAUSE_BETWEEN_BATCHES[1], ge=0)

    @model_validator(mode="after")
    def _check_ranges(self) -> "TimingConfig":
        if self.delay_min > self.delay_max:
            raise ValueError("delay_min phải <= delay_max")
        if self.batch_min > self.batch_max:
            raise ValueError("batch_min phải <= batch_max")
        if self.pause_min > self.pause_max:
            raise ValueError("pause_min phải <= pause_max")
        return self

    @property
    def delay_between_forms(self) -> tuple[float, float]:
        return (self.delay_min, self.delay_max)

    @property
    def batch_size_range(self) -> tuple[int, int]:
        return (self.batch_min, self.batch_max)

    @property
    def pause_between_batches(self) -> tuple[float, float]:
        return (self.pause_min, self.pause_max)


class FormInspectRequest(BaseModel):
    form_url: str = Field(..., description="Link Google Form (viewform / formResponse / edit)")


class JobOptions(BaseModel):
    """Everything that controls how a job maps Excel columns to form entries."""

    mapping_mode: Literal["position", "header"] = Field(
        "position",
        description=(
            "position: cột thứ i -> entry thứ i của form (giống script gốc). "
            "header: tên cột phải là entry.<id> hoặc tiêu đề câu hỏi."
        ),
    )
    entry_list: list[str] | None = Field(
        None,
        description="Ghi đè ENTRY_LIST tự động (chỉ dùng cho mapping_mode=position).",
    )
    page_history: str = Field(
        "auto",
        description=(
            "auto: đi qua tất cả các trang của form; none: không gửi pageHistory; "
            "hoặc chuỗi cố định ví dụ '0,1,2'. Cột Excel tên 'pageHistory' luôn được ưu tiên."
        ),
    )
    checkbox_delimiter: str = Field(
        ";",
        min_length=1,
        description="Ký tự tách nhiều lựa chọn trong ô của câu hỏi checkbox.",
    )
    start_row: int = Field(1, ge=1, description="Dòng dữ liệu bắt đầu gửi (1 = dòng đầu tiên sau tiêu đề).")
    max_rows: int | None = Field(None, ge=1, description="Giới hạn số dòng gửi (bỏ trống = gửi hết).")
    dry_run: bool = Field(False, description="Chỉ tạo payload, không gửi lên Google và không chờ.")
    stop_on_error: bool = Field(False, description="Dừng job ngay khi có dòng gửi lỗi.")


class JobFailure(BaseModel):
    row: int
    reason: str


class JobStatus(BaseModel):
    job_id: str
    status: Literal["pending", "running", "paused", "completed", "failed", "cancelled"]
    form_url: str
    form_title: str = ""
    sheet_name: str = ""
    file_name: str = ""
    timing: TimingConfig
    options: JobOptions
    entry_list: list[str] = []
    mapping: list[dict[str, Any]] = []
    warnings: list[str] = []
    total: int = 0
    sent: int = 0
    success: int = 0
    failed: int = 0
    current_batch_target: int = 0
    current_batch_sent: int = 0
    next_action: str = ""
    failures: list[JobFailure] = []
    logs: list[str] = []
    error: str | None = None
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None
