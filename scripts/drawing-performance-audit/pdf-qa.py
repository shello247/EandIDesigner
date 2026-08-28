"""Read-only PDF content QA and representative Poppler renders."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
from pypdf import PdfReader


root = Path.cwd().resolve()
phase = os.environ.get("AUDIT_PHASE", "")
if root.name == "drawing-performance-pass-1":
    if not re.fullmatch(r"[a-z0-9-]+", phase):
        raise RuntimeError("A guarded AUDIT_PHASE is required")
    output = root / "artifacts" / "drawing-performance" / "pass-1" / phase
    baseline_output = (
        root.parent
        / "drawing-performance-audit-20260826"
        / "artifacts"
        / "drawing-performance"
        / "20260826-baseline"
    )
elif root.name == "drawing-performance-audit-20260826":
    output = root / "artifacts" / "drawing-performance" / "20260826-baseline"
    baseline_output = output
else:
    raise RuntimeError("Run PDF QA only in a registered isolated audit worktree")

if not output.is_dir() or not baseline_output.is_dir():
    raise RuntimeError("Expected guarded export evidence is missing")

poppler = Path(
    r"C:\Users\Sheldon\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe"
)
if not poppler.is_file():
    raise RuntimeError("Bundled Poppler pdftoppm is required")


def compact_text(value: str) -> str:
    return re.sub(r"\s+", "", value)


def analyse(pdf: Path, model: dict, label: str) -> dict:
    reader = PdfReader(pdf)
    texts = [page.extract_text() or "" for page in reader.pages]
    compact = compact_text(" ".join(texts))
    wires = sorted(
        {
            connection.get("wireId", "")
            for sheet in model["sheets"]
            for connection in sheet["connections"]
        }
        - {""}
    )
    route_labels = sorted(
        {
            connection.get("label") or connection.get("wireId", "")
            for sheet in model["sheets"]
            for connection in sheet["connections"]
        }
        - {""}
    )
    page_order = [
        index < len(texts)
        and compact_text(sheet["name"]) in compact_text(texts[index])
        for index, sheet in enumerate(model["sheets"])
    ]
    for page_number in sorted({1, min(4, len(reader.pages)), len(reader.pages)}):
        prefix = output / f"audit_mixed_{len(model['sheets'])}-{label}-page-{page_number}"
        subprocess.run(
            [
                str(poppler),
                "-f",
                str(page_number),
                "-l",
                str(page_number),
                "-scale-to",
                "1400",
                "-singlefile",
                "-png",
                str(pdf),
                str(prefix),
            ],
            check=True,
            capture_output=True,
        )
    return {
        "file": pdf.name,
        "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
        "bytes": pdf.stat().st_size,
        "expectedPages": len(model["sheets"]),
        "actualPages": len(reader.pages),
        "pageOrderMatches": all(page_order),
        "missingExpectedRouteLabels": [
            label for label in route_labels if compact_text(label) not in compact
        ],
        "literalRouteWireIdsNotFound": [
            wire for wire in wires if compact_text(wire) not in compact
        ],
        "privateUseCodepoints": sorted(
            {
                hex(ord(character))
                for text in texts
                for character in text
                if 0xE000 <= ord(character) <= 0xF8FF
            }
        ),
        "pageTextHashes": [
            hashlib.sha256(re.sub(r"\s+", " ", text).encode()).hexdigest()
            for text in texts
        ],
        "pageSizesPoints": [
            [float(page.mediabox.width), float(page.mediabox.height)]
            for page in reader.pages
        ],
    }


records = []
for size in (10, 40, 120):
    model = json.loads((output / f"audit_mixed_{size}.json").read_text(encoding="utf-8"))
    baseline = analyse(
        baseline_output / f"audit_mixed_{size}-baseline.pdf", model, "baseline"
    )
    candidate_name = (
        f"audit_mixed_{size}-{phase}.pdf"
        if root.name == "drawing-performance-pass-1"
        else f"audit_mixed_{size}-diagnostic.pdf"
    )
    candidate = analyse(output / candidate_name, model, "candidate")
    records.append(
        {
            "sheets": size,
            "baseline": baseline,
            "candidate": candidate,
            "sameTextAndPageSizesAsBaseline": (
                baseline["pageTextHashes"] == candidate["pageTextHashes"]
                and baseline["pageSizesPoints"] == candidate["pageSizesPoints"]
            ),
            "wireIdCheckCaveat": (
                "Explicit field labels replace route wire IDs; some PDF text uses "
                "private-use punctuation. Literal ID absence alone does not prove a missing graphic."
            ),
        }
    )

(output / "pdf-qa.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
print(
    json.dumps(
        [
            {
                "sheets": record["sheets"],
                "sameTextAndPageSizesAsBaseline": record[
                    "sameTextAndPageSizesAsBaseline"
                ],
                "baselinePages": record["baseline"]["actualPages"],
                "candidatePages": record["candidate"]["actualPages"],
                "pageOrderMatches": record["candidate"]["pageOrderMatches"],
                "missingExpectedRouteLabels": record["candidate"][
                    "missingExpectedRouteLabels"
                ],
                "literalRouteWireIdsNotFound": len(
                    record["candidate"]["literalRouteWireIdsNotFound"]
                ),
                "privateUseCodepoints": record["candidate"][
                    "privateUseCodepoints"
                ],
            }
            for record in records
        ],
        indent=2,
    )
)
