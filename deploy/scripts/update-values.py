#!/usr/bin/env python3
import re
import sys
from pathlib import Path


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


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: update-values.py VALUES_FILE ACR_LOGIN_SERVER IMAGE_TAG")

    values_file = Path(sys.argv[1])
    acr_login_server = sys.argv[2]
    image_tag = sys.argv[3]

    text = values_file.read_text()
    text = replace_yaml_scalar(text, ["global", "image", "registry"], acr_login_server)
    text = replace_yaml_scalar(text, ["global", "image", "tag"], image_tag)
    values_file.write_text(text)


if __name__ == "__main__":
    main()
