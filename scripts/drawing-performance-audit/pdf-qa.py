"""Read-only PDF content QA and representative Poppler renders of synthetic exports."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
from pypdf import PdfReader

root = Path.cwd().resolve()
if root.name != "drawing-performance-audit-20260826":
    raise RuntimeError("Run PDF QA only in the isolated audit worktree")
output = root / "artifacts/drawing-performance/20260826-baseline"
poppler = Path(r"C:\Users\Sheldon\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe")
records = []
for pdf in sorted(output.glob("audit_mixed_*.pdf")):
    match = re.fullmatch(r"audit_mixed_(10|40|120)-([a-z0-9-]+)\.pdf", pdf.name)
    if not match:
        continue
    size, phase = int(match[1]), match[2]
    model = json.loads((output / f"audit_mixed_{size}.json").read_text(encoding="utf-8"))
    reader = PdfReader(pdf)
    texts = [page.extract_text() or "" for page in reader.pages]
    compact = re.sub(r"\s+", "", " ".join(texts))
    wires = sorted({connection.get("wireId", "") for sheet in model["sheets"] for connection in sheet["connections"]} - {""})
    missing = [wire for wire in wires if re.sub(r"\s+", "", wire) not in compact]
    route_labels = sorted({connection.get("label") or connection.get("wireId", "") for sheet in model["sheets"] for connection in sheet["connections"]} - {""})
    missing_labels = [label for label in route_labels if re.sub(r"\s+", "", label) not in compact]
    page_order = [index < len(texts) and re.sub(r"\s+", "", sheet["name"]) in re.sub(r"\s+", "", texts[index]) for index, sheet in enumerate(model["sheets"])]
    record = {"file": pdf.name, "phase": phase, "expectedPages": size, "actualPages": len(reader.pages), "pageOrderMatches": all(page_order), "missingExpectedRouteLabels": missing_labels, "literalRouteWireIdsNotFound": missing, "wireIdCheckCaveat": "Explicit field labels replace route wire IDs; some PDF text uses private-use punctuation. Literal ID absence alone does not prove a missing graphic.", "privateUseCodepoints": sorted({hex(ord(character)) for text in texts for character in text if 0xE000 <= ord(character) <= 0xF8FF}), "pageTextHashes": [hashlib.sha256(re.sub(r"\s+", " ", text).encode()).hexdigest() for text in texts], "pageSizesPoints": [[float(page.mediabox.width), float(page.mediabox.height)] for page in reader.pages]}
    if poppler.exists():
        for page_number in sorted({1, min(4, size), size}):
            prefix = output / f"{pdf.stem}-page-{page_number}"
            subprocess.run([str(poppler), "-f", str(page_number), "-l", str(page_number), "-scale-to", "1400", "-singlefile", "-png", str(pdf), str(prefix)], check=True, capture_output=True)
    records.append(record)
for record in records:
    baseline = next((candidate for candidate in records if candidate["expectedPages"] == record["expectedPages"] and candidate["phase"] == "baseline"), None)
    record["sameTextAndPageSizesAsBaseline"] = bool(baseline and baseline["pageTextHashes"] == record["pageTextHashes"] and baseline["pageSizesPoints"] == record["pageSizesPoints"])
(output / "pdf-qa.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
print(json.dumps([{key: value for key, value in record.items() if key not in ("pageTextHashes", "pageSizesPoints", "literalRouteWireIdsNotFound")} for record in records], indent=2))
