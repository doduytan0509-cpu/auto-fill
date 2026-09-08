from __future__ import annotations

import json
from io import BytesIO

import openpyxl
import pytest

FORM_ID = "1FAIpQLSdTESTFORMID"
VIEWFORM_URL = f"https://docs.google.com/forms/d/e/{FORM_ID}/viewform"

# A minimal but realistic FB_PUBLIC_LOAD_DATA_ payload:
#   page 0: short answer, multiple choice (with "Other")
#   page 1: checkboxes, grid with 2 rows, title/description block (no entry)
FB_DATA = [
    None,
    [
        "Mô tả khảo sát",
        [
            [1001, "Họ và tên", None, 0, [[1312026164, None, 1]]],
            [
                1002,
                "Bạn đồng ý tham gia?",
                None,
                2,
                [[1260632264, [["1", None, None, None, False], ["2", None, None, None, False], ["", None, None, None, True]], 1]],
            ],
            [1003, "Phần 2", "", 8],
            [
                1004,
                "Sở thích",
                None,
                4,
                [[565455947, [["A", None, None, None, False], ["B", None, None, None, False], ["C", None, None, None, False]], 0]],
            ],
            [
                1005,
                "Đánh giá",
                None,
                7,
                [
                    [1633546942, [["1"], ["2"], ["3"]], 1, ["Dòng 1"]],
                    [37768034, [["1"], ["2"], ["3"]], 1, ["Dòng 2"]],
                ],
            ],
            [1006, "Chỉ là tiêu đề", "không có entry", 6],
        ],
        None, None, None, None, None, None,
        "Khảo sát thử nghiệm",
    ],
    f"/forms/d/e/{FORM_ID}/viewform",
    "Khảo sát thử nghiệm",
]

EXPECTED_ENTRIES = [
    "entry.1312026164",
    "entry.1260632264",
    "entry.565455947",
    "entry.1633546942",
    "entry.37768034",
]


def make_form_html() -> str:
    return (
        "<html><head><script>var FB_PUBLIC_LOAD_DATA_ = "
        + json.dumps(FB_DATA, ensure_ascii=False)
        + ";</script></head><body></body></html>"
    )


def make_workbook(rows: list[list], header: list[str], sheet: str = "Coded") -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet
    ws.append(header)
    for r in rows:
        ws.append(r)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.fixture
def form_html() -> str:
    return make_form_html()


@pytest.fixture
def positional_xlsx() -> bytes:
    header = ["name", "consent", "hobby", "grid1", "grid2"]
    rows = [
        ["Nguyễn Văn A", 1, "A;B", 3, 2.0],
        ["Trần B", 2, None, "", None],
        [None, None, None, None, None],  # empty row -> skipped
        ["Lê C", 1.0, "C", 1, 1],
    ]
    return make_workbook(rows, header)


@pytest.fixture
def header_xlsx() -> bytes:
    header = ["Họ và tên", "entry.1260632264", "Sở thích", "pageHistory", "Không khớp"]
    rows = [["X", 1, "B", "0,1", "bỏ"]]
    return make_workbook(rows, header, sheet="Data")


@pytest.fixture
def patch_fetch(monkeypatch, form_html):
    """Serve the fixture HTML instead of hitting docs.google.com."""
    from app import google_form

    monkeypatch.setattr(google_form, "fetch_form_html", lambda url, session=None: form_html)
    return form_html
