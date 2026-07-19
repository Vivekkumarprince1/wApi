#!/usr/bin/env python3
import re
import json
import sys
from pathlib import Path


SERVICES = [
    "api-gateway",
    "auth-service",
    "campaign-service",
    "billing-service",
    "service-provider",
    "automation-service",
    "chat-service",
    "contact-service",
    "webhook-ingestor",
    "websocket-gateway",
    "admin-portal",
    "career-portal",
    "customer-portal",
]


def replace_yaml_scalar(text: str, path: list[str], value: str) -> str:
    lines = text.splitlines()
    stack: list[tuple[int, str]] = []

    for index, line in enumerate(lines):
        if not line.strip() or line.lstrip().startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))
        key_match = re.match(r"^(\s*)([A-Za-z0-9_-]+):(?:\s*(.*))?$", line)
        if not key_match:
            continue

        key = key_match.group(2)
        while stack and stack[-1][0] >= indent:
            stack.pop()
        current_path = [item[1] for item in stack] + [key]

        if current_path == path:
            lines[index] = f"{' ' * indent}{key}: {value}"
            return "\n".join(lines) + "\n"

        if key_match.group(3) == "":
            stack.append((indent, key))

    raise SystemExit(f"Could not find YAML path: {'.'.join(path)}")


def find_yaml_scalar(text: str, path: list[str]) -> str | None:
    stack: list[tuple[int, str]] = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        key_match = re.match(r"^(\s*)([A-Za-z0-9_-]+):(?:\s*(.*))?$", line)
        if not key_match:
            continue
        key = key_match.group(2)
        while stack and stack[-1][0] >= indent:
            stack.pop()
        current_path = [item[1] for item in stack] + [key]
        if current_path == path:
            value = (key_match.group(3) or "").strip()
            return value.strip('"\'') if value else None
        if key_match.group(3) == "":
            stack.append((indent, key))
    return None


def upsert_yaml_scalar(text: str, path: list[str], value: str) -> str:
    try:
        return replace_yaml_scalar(text, path, value)
    except SystemExit:
        pass

    lines = text.splitlines()
    stack: list[tuple[int, str]] = []
    best_match: tuple[int, int, int] | None = None
    for index, line in enumerate(lines):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        key_match = re.match(r"^(\s*)([A-Za-z0-9_-]+):(?:\s*(.*))?$", line)
        if not key_match:
            continue
        current_key = key_match.group(2)
        while stack and stack[-1][0] >= indent:
            stack.pop()
        current_path = [item[1] for item in stack] + [current_key]
        if (
            key_match.group(3) == ""
            and path[: len(current_path)] == current_path
            and len(current_path) < len(path)
        ):
            if best_match is None or len(current_path) > best_match[2]:
                best_match = (index, indent, len(current_path))
        if key_match.group(3) == "":
            stack.append((indent, current_key))

    if best_match is None:
        raise SystemExit(f"Could not find YAML parent path for: {'.'.join(path)}")

    index, indent, matched_length = best_match
    missing_keys = path[matched_length:]
    inserted_lines = []
    for offset, missing_key in enumerate(missing_keys):
        missing_indent = indent + 2 * (offset + 1)
        suffix = f": {value}" if offset == len(missing_keys) - 1 else ":"
        inserted_lines.append(f"{' ' * missing_indent}{missing_key}{suffix}")
    lines[index + 1:index + 1] = inserted_lines
    return "\n".join(lines) + "\n"


def main() -> None:
    if len(sys.argv) not in (5, 6):
        raise SystemExit(
            "usage: update-values.py VALUES_FILE ACR_LOGIN_SERVER IMAGE_TAG CHANGED_SERVICES_JSON [PREVIOUS_VALUES_FILE]"
        )

    values_file = Path(sys.argv[1])
    acr_login_server = sys.argv[2]
    image_tag = sys.argv[3]
    changed_services = set(json.loads(sys.argv[4]))
    previous_file = Path(sys.argv[5]) if len(sys.argv) == 6 else None

    text = values_file.read_text()
    previous_text = previous_file.read_text() if previous_file and previous_file.exists() else text
    previous_global_tag = find_yaml_scalar(previous_text, ["global", "image", "tag"]) or "v1.0.0"
    text = replace_yaml_scalar(text, ["global", "image", "registry"], acr_login_server)
    text = replace_yaml_scalar(text, ["global", "image", "tag"], previous_global_tag)
    for service in SERVICES:
        previous_tag = (
            find_yaml_scalar(previous_text, ["services", service, "image", "tag"])
            or previous_global_tag
        )
        service_tag = image_tag if service in changed_services else previous_tag
        text = upsert_yaml_scalar(text, ["services", service, "image", "tag"], service_tag)
    values_file.write_text(text)


if __name__ == "__main__":
    main()
