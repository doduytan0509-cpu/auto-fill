import time

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.runner import manager
from tests.conftest import EXPECTED_ENTRIES, VIEWFORM_URL


@pytest.fixture
def client():
    return TestClient(app)


def _wait(client, job_id, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        body = client.get(f"/jobs/{job_id}").json()
        if body["status"] in {"completed", "failed", "cancelled"}:
            return body
        time.sleep(0.05)
    raise AssertionError("job did not finish")


def test_health_and_defaults(client):
    assert client.get("/health").json()["status"] == "ok"
    d = client.get("/config/defaults").json()
    assert d == {
        "delay_min": 1.5, "delay_max": 4.0,
        "batch_min": 3, "batch_max": 8,
        "pause_min": 20.0, "pause_max": 60.0,
    }


def test_form_urls(client):
    r = client.get("/form/urls", params={"form_url": VIEWFORM_URL})
    assert r.status_code == 200
    assert r.json()["response_url"].endswith("/formResponse")
    assert client.get("/form/urls", params={"form_url": "https://example.com"}).status_code == 400


def test_form_inspect(client, patch_fetch):
    r = client.post("/form/inspect", json={"form_url": VIEWFORM_URL})
    assert r.status_code == 200
    body = r.json()
    assert body["entry_list"] == EXPECTED_ENTRIES
    assert body["entry_count"] == 5
    assert body["page_count"] == 2
    assert body["entries"][1]["options"] == ["1", "2"]


def test_excel_preview(client, positional_xlsx):
    r = client.post(
        "/excel/preview",
        files={"file": ("data.xlsx", positional_xlsx)},
        data={"limit": "2"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sheet_name"] == "Coded"
    assert body["row_count"] == 3
    assert body["header"] == ["name", "consent", "hobby", "grid1", "grid2"]
    assert body["sample_rows"][0] == ["Nguyễn Văn A", "1", "A;B", "3", "2"]


def test_excel_preview_rejects_non_xlsx(client):
    r = client.post("/excel/preview", files={"file": ("data.csv", b"a,b\n1,2")})
    assert r.status_code == 422


def test_jobs_preview(client, patch_fetch, positional_xlsx):
    r = client.post(
        "/jobs/preview",
        files={"file": ("data.xlsx", positional_xlsx)},
        data={"form_url": VIEWFORM_URL, "limit": "1"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["entry_list"] == EXPECTED_ENTRIES
    assert body["payloads"][0]["payload"]["entry.565455947"] == ["A", "B"]


def test_create_job_dry_run_and_lifecycle(client, patch_fetch, positional_xlsx):
    r = client.post(
        "/jobs",
        files={"file": ("data.xlsx", positional_xlsx)},
        data={
            "form_url": VIEWFORM_URL,
            "delay_min": "0.5", "delay_max": "1",
            "batch_min": "2", "batch_max": "4",
            "pause_min": "5", "pause_max": "10",
            "dry_run": "true",
        },
    )
    assert r.status_code == 202, r.text
    body = r.json()
    job_id = body["job_id"]
    assert body["timing"] == {
        "delay_min": 0.5, "delay_max": 1.0,
        "batch_min": 2, "batch_max": 4,
        "pause_min": 5.0, "pause_max": 10.0,
    }
    assert body["entry_list"] == EXPECTED_ENTRIES
    assert body["total"] == 3

    done = _wait(client, job_id)
    assert done["status"] == "completed"
    assert done["success"] == 3

    payloads = client.get(f"/jobs/{job_id}/payloads").json()
    assert payloads["count"] == 3

    assert any(j["job_id"] == job_id for j in client.get("/jobs").json())
    assert client.post(f"/jobs/{job_id}/cancel").status_code == 409
    assert client.delete(f"/jobs/{job_id}").status_code == 204
    assert client.get(f"/jobs/{job_id}").status_code == 404


def test_create_job_invalid_timing(client, patch_fetch, positional_xlsx):
    r = client.post(
        "/jobs",
        files={"file": ("data.xlsx", positional_xlsx)},
        data={"form_url": VIEWFORM_URL, "delay_min": "5", "delay_max": "1"},
    )
    assert r.status_code == 422
    assert "delay_min" in r.text


def test_create_job_with_entry_list_override(client, patch_fetch, positional_xlsx):
    r = client.post(
        "/jobs",
        files={"file": ("data.xlsx", positional_xlsx)},
        data={
            "form_url": VIEWFORM_URL,
            "entry_list": "entry.1312026164, 1260632264",
            "dry_run": "true",
        },
    )
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["entry_list"] == ["entry.1312026164", "entry.1260632264"]
    assert any("chưa khớp" in w for w in body["warnings"])
    _wait(client, body["job_id"])


def test_create_job_bad_form_url(client, positional_xlsx):
    r = client.post(
        "/jobs",
        files={"file": ("data.xlsx", positional_xlsx)},
        data={"form_url": "https://example.com/nope"},
    )
    assert r.status_code == 400


def test_cancel_running_job(client, patch_fetch, positional_xlsx, monkeypatch):
    import app.runner as runner

    class FakeSession:
        def post(self, *a, **k):
            class R:
                status_code = 200

            return R()

        def close(self):
            pass

    monkeypatch.setattr(runner.requests, "Session", lambda: FakeSession())
    r = client.post(
        "/jobs",
        files={"file": ("data.xlsx", positional_xlsx)},
        data={"form_url": VIEWFORM_URL, "delay_min": "30", "delay_max": "30", "batch_min": "10", "batch_max": "10"},
    )
    assert r.status_code == 202, r.text
    job_id = r.json()["job_id"]
    time.sleep(0.2)
    assert client.post(f"/jobs/{job_id}/cancel").status_code == 200
    done = _wait(client, job_id)
    assert done["status"] == "cancelled"
    manager.remove(job_id)
