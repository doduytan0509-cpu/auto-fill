"""Google Form helpers: normalise URLs, fetch the form and extract entry IDs.

Google renders every public form with a JavaScript blob called
``FB_PUBLIC_LOAD_DATA_`` that describes all questions. We parse that blob to
build the list of ``entry.<id>`` field names in form order, so users only have
to provide the form URL instead of maintaining ``ENTRY_LIST`` by hand.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

import requests

from . import config

FORM_ID_RE = re.compile(r"/forms/d/(e/)?([A-Za-z0-9_-]+)")
FB_DATA_MARKER = "FB_PUBLIC_LOAD_DATA_"

# Question type codes used by Google Forms.
QUESTION_TYPES: dict[int, str] = {
    0: "short_answer",
    1: "paragraph",
    2: "multiple_choice",
    3: "dropdown",
    4: "checkboxes",
    5: "linear_scale",
    6: "title_description",
    7: "grid",
    8: "section",
    9: "date",
    10: "time",
    11: "image",
    12: "video",
    13: "file_upload",
}
CHOICE_TYPES = {2, 3, 4, 5, 7}
NON_INPUT_TYPES = {6, 8, 11, 12, 13}


class FormError(Exception):
    """Raised when the form URL is invalid or the form cannot be parsed."""


@dataclass
class FormEntry:
    entry_id: str
    question_title: str
    question_type: int
    type_name: str
    page: int
    required: bool = False
    row_label: str | None = None  # for grid questions
    options: list[str] = field(default_factory=list)
    has_other: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "entry_id": self.entry_id,
            "question_title": self.question_title,
            "question_type": self.question_type,
            "type_name": self.type_name,
            "page": self.page,
            "required": self.required,
            "row_label": self.row_label,
            "options": self.options,
            "has_other": self.has_other,
        }


@dataclass
class FormInfo:
    form_id: str
    viewform_url: str
    response_url: str
    title: str = ""
    description: str = ""
    page_count: int = 1
    entries: list[FormEntry] = field(default_factory=list)
    collects_email: bool = False

    @property
    def entry_list(self) -> list[str]:
        return [e.entry_id for e in self.entries]

    @property
    def default_page_history(self) -> str:
        return ",".join(str(i) for i in range(self.page_count))

    def to_dict(self) -> dict[str, Any]:
        return {
            "form_id": self.form_id,
            "title": self.title,
            "description": self.description,
            "viewform_url": self.viewform_url,
            "response_url": self.response_url,
            "page_count": self.page_count,
            "default_page_history": self.default_page_history,
            "collects_email": self.collects_email,
            "entry_count": len(self.entries),
            "entry_list": self.entry_list,
            "entries": [e.to_dict() for e in self.entries],
        }


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def parse_form_url(url: str) -> tuple[str, str, str]:
    """Return ``(form_id, viewform_url, response_url)`` for any Google Form URL.

    Accepts ``.../viewform``, ``.../formResponse``, edit links
    (``/forms/d/<id>/edit``) and bare ``/forms/d/e/<id>`` links.
    """
    url = (url or "").strip()
    if not url:
        raise FormError("form_url không được để trống.")
    m = FORM_ID_RE.search(url)
    if not m:
        raise FormError(
            "Không nhận dạng được URL Google Form. "
            "Ví dụ hợp lệ: https://docs.google.com/forms/d/e/<ID>/viewform"
        )
    published = bool(m.group(1))
    form_id = m.group(2)
    base = f"https://docs.google.com/forms/d/{'e/' if published else ''}{form_id}"
    return form_id, f"{base}/viewform", f"{base}/formResponse"


# ---------------------------------------------------------------------------
# Fetch + parse
# ---------------------------------------------------------------------------

def fetch_form_html(viewform_url: str, session: requests.Session | None = None) -> str:
    sess = session or requests.Session()
    try:
        resp = sess.get(
            viewform_url,
            headers={"User-Agent": config.USER_AGENT},
            timeout=config.REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:  # pragma: no cover - network
        raise FormError(f"Không tải được form: {exc}") from exc
    if resp.status_code != 200:
        raise FormError(
            f"Google trả về mã {resp.status_code} khi tải form. "
            "Kiểm tra lại URL hoặc quyền truy cập của form."
        )
    return resp.text


def extract_fb_public_load_data(html: str) -> list[Any]:
    """Locate and decode the ``FB_PUBLIC_LOAD_DATA_`` array inside the HTML."""
    idx = html.find(FB_DATA_MARKER)
    if idx == -1:
        raise FormError("Không tìm thấy FB_PUBLIC_LOAD_DATA_ trong HTML của form.")
    start = html.find("[", idx)
    if start == -1:
        raise FormError("FB_PUBLIC_LOAD_DATA_ không đúng định dạng.")
    try:
        data, _ = json.JSONDecoder().raw_decode(html, start)
    except json.JSONDecodeError as exc:
        raise FormError(f"Không đọc được FB_PUBLIC_LOAD_DATA_: {exc}") from exc
    if not isinstance(data, list):
        raise FormError("FB_PUBLIC_LOAD_DATA_ không phải là mảng.")
    return data


def _safe_get(seq: Any, *idx: int, default: Any = None) -> Any:
    cur = seq
    for i in idx:
        if not isinstance(cur, (list, tuple)) or i >= len(cur):
            return default
        cur = cur[i]
    return default if cur is None else cur


def _option_labels(options: Any) -> tuple[list[str], bool]:
    labels: list[str] = []
    has_other = False
    if not isinstance(options, list):
        return labels, has_other
    for opt in options:
        if not isinstance(opt, list) or not opt:
            continue
        label = opt[0]
        # opt[4] is True for the "Other..." option (which has an empty label)
        if len(opt) > 4 and opt[4] is True:
            has_other = True
            continue
        if label is None:
            continue
        labels.append(str(label))
    return labels, has_other


def parse_form_data(data: list[Any], form_id: str, viewform_url: str, response_url: str) -> FormInfo:
    """Turn the decoded ``FB_PUBLIC_LOAD_DATA_`` array into a :class:`FormInfo`."""
    body = _safe_get(data, 1, default=[])
    items = _safe_get(body, 1, default=[]) or []
    title = _safe_get(body, 8) or _safe_get(data, 3) or ""
    description = _safe_get(body, 0) or ""

    info = FormInfo(
        form_id=form_id,
        viewform_url=viewform_url,
        response_url=response_url,
        title=str(title),
        description=str(description),
    )

    page = 0
    for item in items:
        if not isinstance(item, list):
            continue
        q_title = str(_safe_get(item, 1, default="") or "")
        q_type = _safe_get(item, 3)
        if not isinstance(q_type, int):
            continue
        if q_type == 8:  # section break => new page
            page += 1
            continue
        if q_type in NON_INPUT_TYPES:
            continue
        fields = _safe_get(item, 4, default=[]) or []
        for f in fields:
            if not isinstance(f, list) or not f:
                continue
            raw_id = f[0]
            if raw_id is None:
                continue
            options, has_other = _option_labels(_safe_get(f, 1))
            row_label = None
            row_labels = _safe_get(f, 3)
            if q_type == 7 and isinstance(row_labels, list) and row_labels:
                row_label = str(row_labels[0])
            info.entries.append(
                FormEntry(
                    entry_id=f"entry.{raw_id}",
                    question_title=q_title,
                    question_type=q_type,
                    type_name=QUESTION_TYPES.get(q_type, f"type_{q_type}"),
                    page=page,
                    required=bool(_safe_get(f, 2, default=0)),
                    row_label=row_label,
                    options=options,
                    has_other=has_other,
                )
            )
    info.page_count = page + 1

    # Forms that collect email addresses expose it in body[10]
    email_flag = _safe_get(body, 10, 6)
    info.collects_email = bool(email_flag)
    return info


def fallback_entries_from_html(html: str) -> list[str]:
    """Best-effort extraction of ``entry.<id>`` names via regex."""
    seen: list[str] = []
    for m in re.finditer(r"entry\.(\d+)", html):
        eid = f"entry.{m.group(1)}"
        if eid not in seen:
            seen.append(eid)
    return seen


def inspect_form(form_url: str, session: requests.Session | None = None) -> FormInfo:
    """Fetch the form and return all detected entries (``ENTRY_LIST``)."""
    form_id, viewform_url, response_url = parse_form_url(form_url)
    html = fetch_form_html(viewform_url, session=session)
    try:
        data = extract_fb_public_load_data(html)
        info = parse_form_data(data, form_id, viewform_url, response_url)
    except FormError:
        entries = fallback_entries_from_html(html)
        if not entries:
            raise
        info = FormInfo(form_id=form_id, viewform_url=viewform_url, response_url=response_url)
        info.entries = [
            FormEntry(entry_id=e, question_title="", question_type=-1, type_name="unknown", page=0)
            for e in entries
        ]
    if not info.entries:
        raise FormError("Form không có câu hỏi nào có thể điền (không tìm thấy entry ID).")
    return info
