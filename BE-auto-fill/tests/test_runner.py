import time

from app.excel_reader import read_excel
from app.google_form import inspect_form
from app.models import JobOptions, TimingConfig
from app.runner import Job, build_column_mapping, build_payload
from tests.conftest import EXPECTED_ENTRIES, VIEWFORM_URL


def _form(patch_fetch):
    return inspect_form(VIEWFORM_URL)


def test_position_mapping_and_payload(patch_fetch, positional_xlsx):
    form = _form(patch_fetch)
    excel = read_excel(positional_xlsx)
    options = JobOptions()
    mapping, entries, warnings = build_column_mapping(excel.header, form, options)
    assert entries == EXPECTED_ENTRIES
    assert [m["entry_id"] for m in mapping] == EXPECTED_ENTRIES
    assert warnings == []

    payload = build_payload(excel.rows[0], mapping, form, options)
    assert payload == {
        "entry.1312026164": "Nguyễn Văn A",
        "entry.1260632264": "1",
        "entry.565455947": ["A", "B"],  # checkbox split on ';'
        "entry.1633546942": "3",
        "entry.37768034": "2",
        "pageHistory": "0,1",
    }
    # Empty cells are omitted
    payload2 = build_payload(excel.rows[1], mapping, form, options)
    assert payload2 == {"entry.1312026164": "Trần B", "entry.1260632264": "2", "pageHistory": "0,1"}


def test_position_mapping_warns_on_mismatch(patch_fetch, positional_xlsx):
    form = _form(patch_fetch)
    excel = read_excel(positional_xlsx)
    options = JobOptions(entry_list=["entry.1312026164", "entry.404"])
    mapping, entries, warnings = build_column_mapping(excel.header, form, options)
    assert entries == ["entry.1312026164", "entry.404"]
    assert len(mapping) == 2
    assert any("chưa khớp" in w for w in warnings)
    assert any("entry.404" in w for w in warnings)


def test_header_mapping(patch_fetch, header_xlsx):
    form = _form(patch_fetch)
    excel = read_excel(header_xlsx)
    options = JobOptions(mapping_mode="header", page_history="none")
    mapping, entries, warnings = build_column_mapping(excel.header, form, options)
    kinds = {m["header"]: (m["entry_id"], m["kind"]) for m in mapping}
    assert kinds["Họ và tên"] == ("entry.1312026164", "title")
    assert kinds["entry.1260632264"] == ("entry.1260632264", "entry_id")
    assert kinds["Sở thích"] == ("entry.565455947", "title")
    assert kinds["pageHistory"] == ("pageHistory", "special")
    assert "Không khớp" not in kinds
    assert any("Không khớp" in w for w in warnings)
    assert any("không có cột tương ứng" in w for w in warnings)

    payload = build_payload(excel.rows[0], mapping, form, options)
    # pageHistory column overrides the "none" option
    assert payload["pageHistory"] == "0,1"
    assert payload["entry.565455947"] == "B"


def test_page_history_options(patch_fetch, positional_xlsx):
    form = _form(patch_fetch)
    excel = read_excel(positional_xlsx)
    for opt, expected in [("none", None), ("0,1,2,3", "0,1,2,3"), ("auto", "0,1")]:
        options = JobOptions(page_history=opt)
        mapping, _, _ = build_column_mapping(excel.header, form, options)
        payload = build_payload(excel.rows[0], mapping, form, options)
        assert payload.get("pageHistory") == expected


def test_job_dry_run_completes(patch_fetch, positional_xlsx):
    form = _form(patch_fetch)
    excel = read_excel(positional_xlsx)
    job = Job(form, VIEWFORM_URL, excel, "x.xlsx", TimingConfig(), JobOptions(dry_run=True))
    job.start()
    for _ in range(100):
        if job.is_finished:
            break
        time.sleep(0.05)
    snap = job.snapshot()
    assert snap.status == "completed"
    assert snap.total == 3 and snap.sent == 3 and snap.success == 3 and snap.failed == 0
    assert len(job.payloads) == 3
    assert job.payloads[0]["row"] == 1


def test_job_sends_and_pauses(patch_fetch, positional_xlsx, monkeypatch):
    """Real (mocked) sending: 3 rows, batch size 2 -> one pause, one short delay."""
    import app.runner as runner

    calls = []

    class FakeResp:
        def __init__(self, code):
            self.status_code = code

    class FakeSession:
        def post(self, url, data=None, headers=None, timeout=None):
            calls.append((url, data))
            return FakeResp(200 if len(calls) != 2 else 500)

        def close(self):
            pass

    sleeps = []
    monkeypatch.setattr(runner.requests, "Session", lambda: FakeSession())
    monkeypatch.setattr(runner.Job, "_sleep", lambda self, s: sleeps.append(s) or False)

    form = _form(patch_fetch)
    excel = read_excel(positional_xlsx)
    timing = TimingConfig(delay_min=0.1, delay_max=0.1, batch_min=2, batch_max=2, pause_min=5, pause_max=5)
    job = Job(form, VIEWFORM_URL, excel, "x.xlsx", timing, JobOptions())
    job._run()

    snap = job.snapshot()
    assert snap.status == "completed"
    assert snap.sent == 3 and snap.success == 2 and snap.failed == 1
    assert snap.failures[0].row == 2 and "500" in snap.failures[0].reason
    assert calls[0][0] == form.response_url
    assert calls[0][1]["entry.1312026164"] == "Nguyễn Văn A"
    # delay after row 1, pause after row 2 (batch of 2), nothing after the last row
    assert sleeps == [0.1, 5]


def test_job_cancel(patch_fetch, positional_xlsx, monkeypatch):
    import app.runner as runner

    class FakeSession:
        def post(self, *a, **k):
            class R:
                status_code = 200

            return R()

        def close(self):
            pass

    monkeypatch.setattr(runner.requests, "Session", lambda: FakeSession())
    form = _form(patch_fetch)
    excel = read_excel(positional_xlsx)
    timing = TimingConfig(delay_min=30, delay_max=30, batch_min=10, batch_max=10, pause_min=0, pause_max=0)
    job = Job(form, VIEWFORM_URL, excel, "x.xlsx", timing, JobOptions())
    job.start()
    time.sleep(0.2)
    job.cancel()
    job._thread.join(timeout=5)
    snap = job.snapshot()
    assert snap.status == "cancelled"
    assert snap.sent == 1


def test_start_row_and_max_rows(patch_fetch, positional_xlsx):
    form = _form(patch_fetch)
    excel = read_excel(positional_xlsx)
    job = Job(form, VIEWFORM_URL, excel, "x.xlsx", TimingConfig(), JobOptions(start_row=2, max_rows=1, dry_run=True))
    assert job.total == 1
    job._run()
    assert job.payloads[0]["row"] == 2
    assert job.payloads[0]["payload"]["entry.1312026164"] == "Trần B"
