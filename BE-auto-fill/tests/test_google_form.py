import pytest

from app.google_form import (
    FormError,
    extract_fb_public_load_data,
    fallback_entries_from_html,
    inspect_form,
    parse_form_data,
    parse_form_url,
)
from tests.conftest import EXPECTED_ENTRIES, FORM_ID, VIEWFORM_URL


@pytest.mark.parametrize(
    "url",
    [
        VIEWFORM_URL,
        f"https://docs.google.com/forms/d/e/{FORM_ID}/formResponse",
        f"https://docs.google.com/forms/d/e/{FORM_ID}/viewform?usp=sf_link",
        f"docs.google.com/forms/d/e/{FORM_ID}",
    ],
)
def test_parse_form_url_published(url):
    form_id, view, resp = parse_form_url(url)
    assert form_id == FORM_ID
    assert view == VIEWFORM_URL
    assert resp == f"https://docs.google.com/forms/d/e/{FORM_ID}/formResponse"


def test_parse_form_url_edit_link():
    form_id, view, resp = parse_form_url("https://docs.google.com/forms/d/abcDEF_123/edit")
    assert form_id == "abcDEF_123"
    assert view == "https://docs.google.com/forms/d/abcDEF_123/viewform"
    assert resp == "https://docs.google.com/forms/d/abcDEF_123/formResponse"


@pytest.mark.parametrize("url", ["", "https://example.com/not-a-form", "docs.google.com/spreadsheets/d/x"])
def test_parse_form_url_invalid(url):
    with pytest.raises(FormError):
        parse_form_url(url)


def test_extract_and_parse(form_html):
    data = extract_fb_public_load_data(form_html)
    info = parse_form_data(data, FORM_ID, VIEWFORM_URL, VIEWFORM_URL.replace("viewform", "formResponse"))
    assert info.title == "Khảo sát thử nghiệm"
    assert info.description == "Mô tả khảo sát"
    assert info.entry_list == EXPECTED_ENTRIES
    assert info.page_count == 2
    assert info.default_page_history == "0,1"

    by_id = {e.entry_id: e for e in info.entries}
    assert by_id["entry.1312026164"].type_name == "short_answer"
    assert by_id["entry.1312026164"].required is True
    assert by_id["entry.1312026164"].page == 0

    mc = by_id["entry.1260632264"]
    assert mc.type_name == "multiple_choice"
    assert mc.options == ["1", "2"]
    assert mc.has_other is True

    cb = by_id["entry.565455947"]
    assert cb.type_name == "checkboxes"
    assert cb.page == 1
    assert cb.required is False

    g1 = by_id["entry.1633546942"]
    assert g1.type_name == "grid"
    assert g1.row_label == "Dòng 1"
    assert by_id["entry.37768034"].row_label == "Dòng 2"


def test_extract_missing_marker():
    with pytest.raises(FormError):
        extract_fb_public_load_data("<html>no data here</html>")


def test_fallback_regex():
    html = '<input name="entry.111"><input name="entry.222"><input name="entry.111">'
    assert fallback_entries_from_html(html) == ["entry.111", "entry.222"]


def test_inspect_form_uses_fetch(patch_fetch):
    info = inspect_form(VIEWFORM_URL)
    assert info.entry_list == EXPECTED_ENTRIES
    assert info.response_url.endswith("/formResponse")


def test_inspect_form_fallback(monkeypatch):
    from app import google_form

    monkeypatch.setattr(
        google_form,
        "fetch_form_html",
        lambda url, session=None: '<form><input name="entry.999"></form>',
    )
    info = inspect_form(VIEWFORM_URL)
    assert info.entry_list == ["entry.999"]
    assert info.entries[0].type_name == "unknown"
