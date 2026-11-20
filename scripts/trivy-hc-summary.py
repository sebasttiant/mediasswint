#!/usr/bin/env python3
"""Summarize HIGH/CRITICAL findings from Trivy JSON reports.

Exit 0: every file is a valid Trivy document (zero findings is VALID_SCAN, not approval).
Exit 2: a file is missing, empty, not JSON, or not a Trivy report.
This script never applies the HIGH/CRITICAL gate.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def invalid(path: Path, message: str) -> int:
    print(f"INVALID_SCAN {path}: {message}", file=sys.stderr)
    return 2


def summarize(path: Path) -> int:
    if not path.is_file():
        return invalid(path, "file not found")
    raw = path.read_text()
    if not raw.strip():
        return invalid(path, "empty report")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        return invalid(path, f"JSON: {error}")
    if not isinstance(data, dict) or data == {}:
        return invalid(path, "empty or non-object JSON is not a Trivy report")
    schema = data.get("SchemaVersion")
    if type(schema) is not int:
        return invalid(path, "missing SchemaVersion")
    artifact = data.get("ArtifactName")
    if not isinstance(artifact, str) or not artifact.strip():
        return invalid(path, "missing ArtifactName")
    results = data.get("Results")
    if results is None:
        results = []
    if not isinstance(results, list):
        return invalid(path, "Results must be a list")

    high = crit = 0
    pkgs: dict[str, set[str]] = {}
    for result in results:
        if not isinstance(result, dict):
            return invalid(path, "each Result must be an object")
        vulns = result.get("Vulnerabilities")
        if vulns is None:
            continue
        if not isinstance(vulns, list):
            return invalid(path, "Vulnerabilities must be a list")
        for vuln in vulns:
            if not isinstance(vuln, dict):
                return invalid(path, "each vulnerability must be an object")
            sev = vuln.get("Severity")
            if sev == "HIGH":
                high += 1
            elif sev == "CRITICAL":
                crit += 1
            else:
                continue
            pkg = vuln.get("PkgName") or vuln.get("PkgID") or "?"
            pkgs.setdefault(pkg, set()).add(str(vuln.get("VulnerabilityID")))

    print(f"VALID_SCAN {path}: CRITICAL={crit} HIGH={high} artifact={artifact}")
    for pkg in sorted(pkgs):
        print(f"  {pkg}: {', '.join(sorted(pkgs[pkg]))}")
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: trivy-hc-summary.py REPORT.json [...]", file=sys.stderr)
        return 2
    code = 0
    for raw in sys.argv[1:]:
        result = summarize(Path(raw))
        if result != 0:
            code = result
    return code


if __name__ == "__main__":
    raise SystemExit(main())
