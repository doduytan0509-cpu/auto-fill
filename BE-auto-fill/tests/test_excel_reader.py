import datetime as dt

import pytest

from app.excel_reader import ExcelError, normalize_cell, read_excel
from tests.conftest import make_workbook


def test_read_excel_prefers_coded_sheet(positional_xlsx):
    data = read_excel(positional_xlsx)
    assert data.sheet_name == "Coded"
    assert data.header == ["name", "consent", "hobby", "grid1", "grid2"]
    assert data.row_count == 3  # the empty row is skipped
    assert data.rows[0][0] == "Nguyễn Văn A"


def test_read_excel_explicit_sheet_missing(positional_xlsx):
    with pytest.raises(ExcelError):
        read_excel(positional_xlsx, sheet_name="Nope")


def test_read_excel_first_sheet_fallback(header_xlsx):
    data = read_excel(header_xlsx)
    assert data.sheet_name == "Data"
    assert data.sheet_names == ["Data"]


def test_read_excel_header_row_offset():
    content = make_workbook([["junk", None], ["a", "b"], [1, 2]], header=["title row", None])
    data = read_excel(content, header_row=3)
    assert data.header == ["a", "b"]
    assert data.rows == [[1, 2]]


def test_read_excel_invalid_bytes():
    with pytest.raises(ExcelError):
        read_excel(b"not an xlsx file")
    with pytest.raises(ExcelError):
        read_excel(b"")


@pytest.mark.parametrize(
    "value, expected",
    [
        (None, None),
        ("", None),
        ("   ", None),
        ("nan", None),
        ("NaN", None),
        (3.0, "3"),
        (3.5, "3.5"),
        (7, "7"),
        (True, "TRUE"),
        (" abc ", "abc"),
        (float("nan"), None),
        (dt.datetime(2024, 5, 1), "2024-05-01"),
        (dt.datetime(2024, 5, 1, 9, 30), "2024-05-01 09:30:00"),
        (dt.date(2024, 5, 1), "2024-05-01"),
        (dt.time(9, 5), "09:05"),
    ],
)
def test_normalize_cell(value, expected):
    assert normalize_cell(value) == expected
