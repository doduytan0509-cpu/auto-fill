"""Background job runner: builds payloads from Excel rows and posts them.

The sending loop mirrors the original script:

* rows are sent one by one;
* after each row a short random delay (``delay_between_forms``);
* every batch of ``batch_size_range`` rows a longer random pause
  (``pause_between_batches``).
"""

from __future__ import annotations

import random
import threading
import time
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any

import requests

from . import config
from .excel_reader import SPECIAL_COLUMNS, ExcelData, normalize_cell
from .google_form import FormEntry, FormInfo
from .models import JobFailure, JobOptions, JobStatus, TimingConfig

MAX_LOG_LINES = 300
MAX_FAILURES = 500


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Column mapping
# ---------------------------------------------------------------------------

def _norm_key(text: str) -> str:
    return " ".join(str(text).strip().lower().split())


def build_column_mapping(
    header: list[str],
    form: FormInfo,
    options: JobOptions,
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    """Decide which Excel column feeds which form entry.

    Returns ``(mapping, entry_list, warnings)`` where ``mapping`` is a list of
    ``{"column": idx, "header": name, "entry_id": id, "kind": ...}``.
    """
    warnings: list[str] = []
    mapping: list[dict[str, Any]] = []

    # Special pass-through columns are handled in either mode.
    special_cols: dict[int, str] = {}
    for idx, name in enumerate(header):
        key = _norm_key(name)
        if key in SPECIAL_COLUMNS:
            special_cols[idx] = SPECIAL_COLUMNS[key]

    entries_by_id: dict[str, FormEntry] = {e.entry_id: e for e in form.entries}

    if options.mapping_mode == "header":
        by_title: dict[str, list[FormEntry]] = {}
        for e in form.entries:
            by_title.setdefault(_norm_key(e.question_title), []).append(e)
            if e.row_label:
                by_title.setdefault(_norm_key(f"{e.question_title} [{e.row_label}]"), []).append(e)
        used: set[str] = set()
        for idx, name in enumerate(header):
            if idx in special_cols:
                mapping.append({"column": idx, "header": name, "entry_id": special_cols[idx], "kind": "special"})
                continue
            raw = str(name).strip()
            candidate = raw if raw.startswith("entry.") else (f"entry.{raw}" if raw.isdigit() else None)
            if candidate and candidate in entries_by_id:
                mapping.append({"column": idx, "header": name, "entry_id": candidate, "kind": "entry_id"})
                used.add(candidate)
                continue
            matches = [e for e in by_title.get(_norm_key(raw), []) if e.entry_id not in used]
            if matches:
                mapping.append({"column": idx, "header": name, "entry_id": matches[0].entry_id, "kind": "title"})
                used.add(matches[0].entry_id)
                continue
            warnings.append(f"Cột '{name}' (#{idx}) không khớp câu hỏi nào của form, sẽ bỏ qua.")
        entry_list = [m["entry_id"] for m in mapping if m["kind"] != "special"]
        missing = [e.entry_id for e in form.entries if e.entry_id not in used]
        if missing:
            warnings.append(f"{len(missing)} entry của form không có cột tương ứng: {', '.join(missing[:10])}"
                            + (" ..." if len(missing) > 10 else ""))
        return mapping, entry_list, warnings

    # --- position mode -------------------------------------------------------
    entry_list = list(options.entry_list) if options.entry_list else form.entry_list
    data_cols = [i for i in range(len(header)) if i not in special_cols]
    if len(entry_list) != len(data_cols):
        warnings.append(
            f"Số mã entry ({len(entry_list)}) chưa khớp với số cột dữ liệu ({len(data_cols)}). "
            f"Chỉ {min(len(entry_list), len(data_cols))} cột đầu tiên được gửi."
        )
    for pos, idx in enumerate(data_cols):
        if pos >= len(entry_list):
            break
        eid = entry_list[pos]
        if options.entry_list and eid not in entries_by_id:
            warnings.append(f"Entry '{eid}' (cột #{idx}) không tồn tại trong form được phân tích.")
        mapping.append({"column": idx, "header": header[idx], "entry_id": eid, "kind": "position"})
    for idx, key in special_cols.items():
        mapping.append({"column": idx, "header": header[idx], "entry_id": key, "kind": "special"})
    mapping.sort(key=lambda m: m["column"])
    return mapping, entry_list[: len(data_cols)], warnings


# ---------------------------------------------------------------------------
# Payload building
# ---------------------------------------------------------------------------

def build_payload(
    row: list[Any],
    mapping: list[dict[str, Any]],
    form: FormInfo,
    options: JobOptions,
) -> dict[str, Any]:
    entries_by_id: dict[str, FormEntry] = {e.entry_id: e for e in form.entries}
    payload: dict[str, Any] = {}
    row_page_history: str | None = None

    for m in mapping:
        idx = m["column"]
        if idx >= len(row):
            continue
        value = normalize_cell(row[idx])
        if value is None:
            continue
        eid = m["entry_id"]
        if eid == "pageHistory":
            row_page_history = value
            continue
        entry = entries_by_id.get(eid)
        if entry is not None and entry.question_type == 4 and options.checkbox_delimiter in value:
            parts = [p.strip() for p in value.split(options.checkbox_delimiter)]
            payload[eid] = [p for p in parts if p]
        else:
            payload[eid] = value

    if row_page_history is not None:
        payload["pageHistory"] = row_page_history
    elif options.page_history == "auto":
        payload["pageHistory"] = form.default_page_history
    elif options.page_history and options.page_history.lower() != "none":
        payload["pageHistory"] = options.page_history
    return payload


# ---------------------------------------------------------------------------
# Job
# ---------------------------------------------------------------------------

class Job:
    def __init__(
        self,
        form: FormInfo,
        form_url: str,
        excel: ExcelData,
        file_name: str,
        timing: TimingConfig,
        options: JobOptions,
    ) -> None:
        self.job_id = uuid.uuid4().hex[:12]
        self.form = form
        self.form_url = form_url
        self.excel = excel
        self.file_name = file_name
        self.timing = timing
        self.options = options
        self._lock = threading.Lock()
        self._cancel = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()
        self._thread: threading.Thread | None = None

        self.status: str = "pending"
        self.created_at = _now()
        self.started_at: str | None = None
        self.finished_at: str | None = None
        self.error: str | None = None
        self.logs: list[str] = []
        self.failures: list[JobFailure] = []
        self.payloads: list[dict[str, Any]] = []
        self.sent = 0
        self.success = 0
        self.failed = 0
        self.current_batch_target = 0
        self.current_batch_sent = 0
        self.next_action = ""

        self.mapping, self.entry_list, self.warnings = build_column_mapping(excel.header, form, options)
        start = options.start_row - 1
        end = start + options.max_rows if options.max_rows else None
        self.rows = excel.rows[start:end]
        self.total = len(self.rows)
        self.row_offset = start

    # -- helpers -----------------------------------------------------------
    def log(self, msg: str) -> None:
        line = f"[{_now()}] {msg}"
        with self._lock:
            self.logs.append(line)
            if len(self.logs) > MAX_LOG_LINES:
                del self.logs[: len(self.logs) - MAX_LOG_LINES]

    def _wait_while_paused(self) -> None:
        """Wait while the job is paused until resumed or cancelled."""
        while not self._pause_event.is_set():
            if self._cancel.is_set():
                return
            time.sleep(0.1)

    def _sleep(self, seconds: float) -> bool:
        """Sleep but wake up early if cancelled or handle pause. Returns True if cancelled."""
        if seconds <= 0:
            return self._cancel.is_set()
        end_time = time.time() + seconds
        while time.time() < end_time:
            if self._cancel.is_set():
                return True
            if not self._pause_event.is_set():
                self._wait_while_paused()
                if self._cancel.is_set():
                    return True
            time.sleep(min(0.1, max(0.01, end_time - time.time())))
        return self._cancel.is_set()

    def pause(self) -> None:
        with self._lock:
            if self.status != "running":
                return
            self.status = "paused"
            self.next_action = "Đang tạm dừng"
            self._pause_event.clear()

    def resume(self) -> None:
        with self._lock:
            if self.status != "paused":
                return
            self.status = "running"
            self.next_action = ""
            self._pause_event.set()

    def cancel(self) -> None:
        self._cancel.set()
        self._pause_event.set()

    @property
    def is_finished(self) -> bool:
        return self.status in {"completed", "failed", "cancelled"}

    def snapshot(self) -> JobStatus:
        with self._lock:
            return JobStatus(
                job_id=self.job_id,
                status=self.status,  # type: ignore[arg-type]
                form_url=self.form_url,
                form_title=self.form.title,
                sheet_name=self.excel.sheet_name,
                file_name=self.file_name,
                timing=self.timing,
                options=self.options,
                entry_list=self.entry_list,
                mapping=self.mapping,
                warnings=list(self.warnings),
                total=self.total,
                sent=self.sent,
                success=self.success,
                failed=self.failed,
                current_batch_target=self.current_batch_target,
                current_batch_sent=self.current_batch_sent,
                next_action=self.next_action,
                failures=list(self.failures[-50:]),
                logs=list(self.logs[-50:]),
                error=self.error,
                created_at=self.created_at,
                started_at=self.started_at,
                finished_at=self.finished_at,
            )

    # -- execution ---------------------------------------------------------
    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name=f"autofill-{self.job_id}", daemon=True)
        self._thread.start()

    def _record_failure(self, row_no: int, reason: str) -> None:
        with self._lock:
            self.failed += 1
            if len(self.failures) < MAX_FAILURES:
                self.failures.append(JobFailure(row=row_no, reason=reason))

    def _run(self) -> None:
        with self._lock:
            self.status = "running"
            self.started_at = _now()
        timing = self.timing
        session = requests.Session()
        headers = {"User-Agent": config.USER_AGENT, "Referer": self.form.viewform_url}

        self.current_batch_target = random.randint(*timing.batch_size_range)
        self.current_batch_sent = 0
        self.log(
            f"Tổng số dòng cần điền: {self.total}. Bắt đầu gửi đợt 1 (gồm {self.current_batch_target} form)."
            + (" [DRY RUN]" if self.options.dry_run else "")
        )

        try:
            for i, row in enumerate(self.rows):
                if self._cancel.is_set():
                    break
                if not self._pause_event.is_set():
                    self._wait_while_paused()
                if self._cancel.is_set():
                    break
                row_no = self.row_offset + i + 1  # 1-based data row number
                payload = build_payload(row, self.mapping, self.form, self.options)
                if len(self.payloads) < (self.total if self.options.dry_run else config.MAX_STORED_PAYLOADS):
                    self.payloads.append({"row": row_no, "payload": payload})

                if self.options.dry_run:
                    with self._lock:
                        self.sent += 1
                        self.success += 1
                    continue

                self.next_action = f"Đang gửi dòng {row_no}"
                try:
                    resp = session.post(
                        self.form.response_url,
                        data=payload,
                        headers=headers,
                        timeout=config.REQUEST_TIMEOUT,
                    )
                    if resp.status_code == 200:
                        with self._lock:
                            self.success += 1
                    else:
                        self._record_failure(row_no, f"HTTP {resp.status_code}")
                        self.log(f"Dòng {row_no} lỗi mã trạng thái: {resp.status_code}")
                        if self.options.stop_on_error:
                            raise RuntimeError(f"Dừng do lỗi ở dòng {row_no} (HTTP {resp.status_code}).")
                except RuntimeError:
                    raise
                except Exception as exc:  # network errors etc.
                    self._record_failure(row_no, str(exc))
                    self.log(f"Dòng {row_no} gặp sự cố: {exc}")
                    if self.options.stop_on_error:
                        raise RuntimeError(f"Dừng do lỗi ở dòng {row_no}: {exc}") from exc
                finally:
                    with self._lock:
                        self.sent += 1
                        self.current_batch_sent += 1

                if i < self.total - 1:
                    if self.current_batch_sent >= self.current_batch_target:
                        pause = round(random.uniform(*timing.pause_between_batches), 1)
                        self.current_batch_target = random.randint(*timing.batch_size_range)
                        self.current_batch_sent = 0
                        self.log(
                            f"Đã gửi xong một đợt. Tạm nghỉ {pause}s... "
                            f"Đợt tiếp theo sẽ gửi {self.current_batch_target} form."
                        )
                        self.next_action = f"Nghỉ giữa đợt {pause}s"
                        if self._sleep(pause):
                            break
                    else:
                        delay = round(random.uniform(*timing.delay_between_forms), 1)
                        self.next_action = f"Nghỉ {delay}s trước dòng tiếp theo"
                        if self._sleep(delay):
                            break
        except Exception as exc:
            with self._lock:
                self.status = "failed"
                self.error = str(exc)
                self.finished_at = _now()
            self.log(f"Job dừng do lỗi: {exc}")
            return
        finally:
            session.close()

        with self._lock:
            self.status = "cancelled" if self._cancel.is_set() and self.sent < self.total else "completed"
            self.finished_at = _now()
            self.next_action = ""
        self.log(f"--- HOÀN TẤT --- Thành công: {self.success}/{self.total}. Thất bại: {self.failed}/{self.total}.")


class JobManager:
    def __init__(self) -> None:
        self._jobs: "OrderedDict[str, Job]" = OrderedDict()
        self._lock = threading.Lock()

    def add(self, job: Job) -> Job:
        with self._lock:
            self._jobs[job.job_id] = job
            self._prune()
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def remove(self, job_id: str) -> bool:
        with self._lock:
            return self._jobs.pop(job_id, None) is not None

    def all(self) -> list[Job]:
        with self._lock:
            return list(self._jobs.values())

    def _prune(self) -> None:
        finished = [j for j in self._jobs.values() if j.is_finished]
        excess = len(finished) - config.MAX_FINISHED_JOBS
        for job in finished[:max(excess, 0)]:
            self._jobs.pop(job.job_id, None)


manager = JobManager()
