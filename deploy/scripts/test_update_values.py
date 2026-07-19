#!/usr/bin/env python3
import re
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "deploy/scripts/update-values.py"
SOURCE_VALUES = ROOT / "deploy/gitops/production-values.yaml"


def service_tag(text: str, service: str) -> str:
    match = re.search(
        rf"(?ms)^  {re.escape(service)}:\n(?:(?:    .*|\s*)\n)*?"
        rf"    image:\n      tag: ([^\s#]+)$",
        text,
    )
    if not match:
        raise AssertionError(f"No image tag found for {service}")
    return match.group(1)


class UpdateValuesTest(unittest.TestCase):
    def run_update(
        self,
        values: Path,
        tag: str,
        changed_services: str,
        previous: Path,
    ) -> None:
        subprocess.run(
            [
                "python3",
                str(SCRIPT),
                str(values),
                "example.azurecr.io",
                tag,
                changed_services,
                str(previous),
            ],
            check=True,
        )

    def test_only_changed_service_receives_new_tag(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            previous = directory_path / "previous.yaml"
            current = directory_path / "current.yaml"
            previous.write_text(SOURCE_VALUES.read_text())

            self.run_update(previous, "oldsha", '["auth-service", "career-portal"]', previous)
            current.write_text(SOURCE_VALUES.read_text())
            self.run_update(current, "newsha", '["auth-service"]', previous)

            text = current.read_text()
            self.assertEqual(service_tag(text, "auth-service"), "newsha")
            self.assertEqual(service_tag(text, "career-portal"), "oldsha")
            self.assertEqual(service_tag(text, "customer-portal"), "v1.0.0")


if __name__ == "__main__":
    unittest.main()
