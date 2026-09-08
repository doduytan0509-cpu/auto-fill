"""FastAPI application exposing the auto-fill workflow as HTTP endpoints.

Run with::

    uvicorn app.main:app --reload

Then open http://127.0.0.1:8000/docs for the interactive Swagger UI.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import ValidationError

from . import __version__, config
from .excel_reader import ExcelError, normalize_cell, read_excel
from .google_form import FormError, inspect_form, parse_form_url
from .models import FormInspectRequest, JobOptions, JobStatus, TimingConfig
from .runner import Job, build_column_mapping, build_payload, manager

app = FastAPI(
    title="Auto Fill Google Forms API",
    version=__version__,
    description=(
        "Tự động điền Google Form từ file Excel.\n\n"
        "Quy trình: `POST /form/inspect` để lấy ENTRY_LIST từ FORM_URL → "
        "`POST /excel/preview` để kiểm tra file Excel → `POST /jobs` để bắt đầu gửi → "
        "`GET /jobs/{job_id}` để theo dõi tiến độ."
    ),
)

ALLOWED_EXTENSIONS = (".xlsx", ".xlsm")


def _validation_detail(exc: ValidationError) -> list[dict[str, Any]]:
    """JSON-safe version of ``ValidationError.errors()``."""
    return [
        {"loc": [str(x) for x in err.get("loc", ())], "msg": err.get("msg", ""), "type": err.get("type", "")}
        for err in exc.errors()
    ]


def _parse_entry_list(raw: str | None) -> list[str] | None:
    if raw is None or raw.strip() == "":
        return None
    raw = raw.strip()
    if raw.startswith("["):
        try:
            items = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise HTTPException(422, f"entry_list không phải JSON hợp lệ: {exc}") from exc
    else:
        items = [p for p in raw.replace("\n", ",").split(",")]
    result: list[str] = []
    for item in items:
        text = str(item).strip()
        if not text:
            continue
        if text.isdigit():
            text = f"entry.{text}"
        result.append(text)
    return result or None


async def _read_upload(file: UploadFile) -> bytes:
    name = (file.filename or "").lower()
    if not name.endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(422, "Chỉ hỗ trợ file Excel định dạng .xlsx / .xlsm.")
    content = await file.read()
    if not content:
        raise HTTPException(422, "File upload rỗng.")
    return content


def _timing(
    delay_min: float | None,
    delay_max: float | None,
    batch_min: int | None,
    batch_max: int | None,
    pause_min: float | None,
    pause_max: float | None,
) -> TimingConfig:
    values: dict[str, Any] = {}
    for key, val in (
        ("delay_min", delay_min),
        ("delay_max", delay_max),
        ("batch_min", batch_min),
        ("batch_max", batch_max),
        ("pause_min", pause_min),
        ("pause_max", pause_max),
    ):
        if val is not None:
            values[key] = val
    try:
        return TimingConfig(**values)
    except ValidationError as exc:
        raise HTTPException(422, _validation_detail(exc)) from exc


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["meta"])
def health() -> dict[str, Any]:
    return {"status": "ok", "version": __version__}


@app.get("/config/defaults", tags=["meta"], response_model=TimingConfig)
def default_timing() -> TimingConfig:
    """Ba mức thời gian mặc định (có thể ghi đè bằng biến môi trường hoặc theo từng job)."""
    return TimingConfig()


# ---------------------------------------------------------------------------
# Form
# ---------------------------------------------------------------------------

@app.post("/form/inspect", tags=["form"])
def form_inspect(req: FormInspectRequest) -> dict[str, Any]:
    """Nhập FORM_URL, tự động tải form và trả về ENTRY_LIST cùng thông tin từng câu hỏi."""
    try:
        info = inspect_form(req.form_url)
    except FormError as exc:
        raise HTTPException(400, str(exc)) from exc
    return info.to_dict()


@app.get("/form/urls", tags=["form"])
def form_urls(form_url: str = Query(..., description="Bất kỳ link Google Form nào")) -> dict[str, str]:
    """Chuẩn hoá link form thành viewform / formResponse (không cần mạng)."""
    try:
        form_id, viewform_url, response_url = parse_form_url(form_url)
    except FormError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"form_id": form_id, "viewform_url": viewform_url, "response_url": response_url}


# ---------------------------------------------------------------------------
# Excel
# ---------------------------------------------------------------------------

@app.post("/excel/preview", tags=["excel"])
async def excel_preview(
    file: UploadFile = File(..., description="File Excel .xlsx"),
    sheet_name: str | None = Form(None, description="Tên sheet (mặc định: 'Coded' hoặc sheet đầu tiên)"),
    header_row: int = Form(1, ge=1),
    limit: int = Form(5, ge=0, le=100, description="Số dòng mẫu trả về"),
) -> dict[str, Any]:
    """Upload file Excel để xem tiêu đề cột và vài dòng dữ liệu đầu tiên."""
    content = await _read_upload(file)
    try:
        data = read_excel(content, sheet_name=sheet_name, header_row=header_row)
    except ExcelError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {
        "file_name": file.filename,
        "sheet_name": data.sheet_name,
        "sheet_names": data.sheet_names,
        "header": data.header,
        "column_count": len(data.header),
        "row_count": data.row_count,
        "sample_rows": [[normalize_cell(v) for v in row] for row in data.rows[:limit]],
    }


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

@app.post("/jobs", tags=["jobs"], response_model=JobStatus, status_code=202)
async def create_job(
    file: UploadFile = File(..., description="File Excel chứa dữ liệu cần điền"),
    form_url: str = Form(..., description="FORM_URL của Google Form"),
    sheet_name: str | None = Form(None),
    header_row: int = Form(1, ge=1),
    # --- 3 mức thời gian ---------------------------------------------------
    delay_min: float | None = Form(None, ge=0, description="DELAY_BETWEEN_FORMS min (giây)"),
    delay_max: float | None = Form(None, ge=0, description="DELAY_BETWEEN_FORMS max (giây)"),
    batch_min: int | None = Form(None, ge=1, description="BATCH_SIZE_RANGE min (số form / đợt)"),
    batch_max: int | None = Form(None, ge=1, description="BATCH_SIZE_RANGE max (số form / đợt)"),
    pause_min: float | None = Form(None, ge=0, description="PAUSE_BETWEEN_BATCHES min (giây)"),
    pause_max: float | None = Form(None, ge=0, description="PAUSE_BETWEEN_BATCHES max (giây)"),
    # --- mapping / options ---------------------------------------------------
    mapping_mode: str = Form("position", pattern="^(position|header)$"),
    entry_list: str | None = Form(
        None,
        description="Ghi đè ENTRY_LIST: JSON array hoặc danh sách cách nhau bằng dấu phẩy. Bỏ trống = tự động lấy từ form.",
    ),
    page_history: str = Form("auto", description="auto | none | chuỗi cố định ví dụ 0,1,2"),
    checkbox_delimiter: str = Form(";", min_length=1),
    start_row: int = Form(1, ge=1),
    max_rows: int | None = Form(None, ge=1),
    dry_run: bool = Form(False),
    stop_on_error: bool = Form(False),
) -> JobStatus:
    """Upload Excel + FORM_URL + cấu hình thời gian → tạo job gửi form chạy nền."""
    content = await _read_upload(file)
    timing = _timing(delay_min, delay_max, batch_min, batch_max, pause_min, pause_max)
    try:
        options = JobOptions(
            mapping_mode=mapping_mode,  # type: ignore[arg-type]
            entry_list=_parse_entry_list(entry_list),
            page_history=page_history,
            checkbox_delimiter=checkbox_delimiter,
            start_row=start_row,
            max_rows=max_rows,
            dry_run=dry_run,
            stop_on_error=stop_on_error,
        )
    except ValidationError as exc:
        raise HTTPException(422, _validation_detail(exc)) from exc

    try:
        excel = read_excel(content, sheet_name=sheet_name, header_row=header_row)
    except ExcelError as exc:
        raise HTTPException(400, str(exc)) from exc
    try:
        form = inspect_form(form_url)
    except FormError as exc:
        raise HTTPException(400, str(exc)) from exc

    job = Job(form, form_url, excel, file.filename or "upload.xlsx", timing, options)
    if job.total == 0:
        raise HTTPException(400, "Không có dòng dữ liệu nào để gửi (kiểm tra sheet / start_row / max_rows).")
    manager.add(job)
    job.start()
    return job.snapshot()


@app.post("/jobs/preview", tags=["jobs"])
async def preview_job(
    file: UploadFile = File(...),
    form_url: str = Form(...),
    sheet_name: str | None = Form(None),
    header_row: int = Form(1, ge=1),
    mapping_mode: str = Form("position", pattern="^(position|header)$"),
    entry_list: str | None = Form(None),
    page_history: str = Form("auto"),
    checkbox_delimiter: str = Form(";", min_length=1),
    start_row: int = Form(1, ge=1),
    limit: int = Form(3, ge=0, le=50),
) -> dict[str, Any]:
    """Xem trước mapping cột → entry và payload của vài dòng đầu, không gửi gì cả."""
    content = await _read_upload(file)
    try:
        options = JobOptions(
            mapping_mode=mapping_mode,  # type: ignore[arg-type]
            entry_list=_parse_entry_list(entry_list),
            page_history=page_history,
            checkbox_delimiter=checkbox_delimiter,
            start_row=start_row,
        )
        excel = read_excel(content, sheet_name=sheet_name, header_row=header_row)
        form = inspect_form(form_url)
    except ValidationError as exc:
        raise HTTPException(422, _validation_detail(exc)) from exc
    except (ExcelError, FormError) as exc:
        raise HTTPException(400, str(exc)) from exc

    mapping, entries, warnings = build_column_mapping(excel.header, form, options)
    rows = excel.rows[start_row - 1 : start_row - 1 + limit]
    return {
        "form_title": form.title,
        "response_url": form.response_url,
        "sheet_name": excel.sheet_name,
        "row_count": excel.row_count,
        "entry_list": entries,
        "mapping": mapping,
        "warnings": warnings,
        "payloads": [
            {"row": start_row + i, "payload": build_payload(r, mapping, form, options)}
            for i, r in enumerate(rows)
        ],
    }


@app.get("/jobs", tags=["jobs"], response_model=list[JobStatus])
def list_jobs() -> list[JobStatus]:
    return [j.snapshot() for j in manager.all()]


@app.get("/jobs/{job_id}", tags=["jobs"], response_model=JobStatus)
def get_job(job_id: str) -> JobStatus:
    job = manager.get(job_id)
    if job is None:
        raise HTTPException(404, "Không tìm thấy job.")
    return job.snapshot()


@app.get("/jobs/{job_id}/payloads", tags=["jobs"])
def job_payloads(job_id: str, limit: int = Query(20, ge=1, le=1000)) -> dict[str, Any]:
    """Các payload đã tạo (toàn bộ nếu dry_run, nếu không thì vài dòng đầu)."""
    job = manager.get(job_id)
    if job is None:
        raise HTTPException(404, "Không tìm thấy job.")
    return {"job_id": job_id, "count": len(job.payloads), "payloads": job.payloads[:limit]}


@app.post("/jobs/{job_id}/cancel", tags=["jobs"], response_model=JobStatus)
def cancel_job(job_id: str) -> JobStatus:
    job = manager.get(job_id)
    if job is None:
        raise HTTPException(404, "Không tìm thấy job.")
    if job.is_finished:
        raise HTTPException(409, f"Job đã kết thúc với trạng thái '{job.status}'.")
    job.cancel()
    job.log("Nhận yêu cầu huỷ job.")
    return job.snapshot()


@app.delete("/jobs/{job_id}", tags=["jobs"], status_code=204)
def delete_job(job_id: str) -> None:
    job = manager.get(job_id)
    if job is None:
        raise HTTPException(404, "Không tìm thấy job.")
    if not job.is_finished:
        raise HTTPException(409, "Job đang chạy, hãy huỷ trước khi xoá.")
    manager.remove(job_id)
