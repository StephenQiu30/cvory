"""Bounded Tiptap subset accepted by editor, templates and file exchange."""
import json
from urllib.parse import urlparse


def validate_content(value):
    if value is None:
        return value
    if len(json.dumps(value, ensure_ascii=False)) > 150_000:
        raise ValueError("Content exceeds 150 KB.")
    if isinstance(value, str):
        return value
    pending = [(value, 0)]
    count = 0
    while pending:
        node, depth = pending.pop()
        count += 1
        if count > 5000 or depth > 20 or not isinstance(node, dict):
            raise ValueError("Invalid content structure.")
        if node.get("type") not in {"doc", "paragraph", "text", "bulletList", "orderedList", "listItem", "hardBreak"}:
            raise ValueError("Unsupported rich text node.")
        if "text" in node and not isinstance(node["text"], str):
            raise ValueError("Text must be a string.")
        for mark in node.get("marks", []):
            if not isinstance(mark, dict) or mark.get("type") not in {"bold", "italic", "code", "link"}:
                raise ValueError("Unsupported text mark.")
            if mark["type"] == "link" and urlparse(str(mark.get("attrs", {}).get("href", ""))).scheme not in {"https", "http", "mailto", "tel"}:
                raise ValueError("Unsafe link protocol.")
        children = node.get("content", [])
        if not isinstance(children, list):
            raise ValueError("Node content must be an array.")
        pending.extend((child, depth + 1) for child in children)
    return value


def has_text(value):
    if isinstance(value, str):
        return bool(value.strip())
    if not isinstance(value, dict):
        return False
    return bool(value.get("text", "").strip()) or any(has_text(v) for v in value.get("content", []))
