"use client";

import { useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PreviewSource } from "../../data/schema";
import { projectSchematic } from "../../logic/services/projection";
import { renderPreviewSvg } from "../../logic/services/svg";
import styles from "./preview.module.css";

export type SchematicPreviewPresentation =
  | { kind: "standalone" }
  | { kind: "embedded"; toolbarHost: HTMLElement | null };

export function SchematicPreview({ source, allowOutline = false, presentation }: { source: PreviewSource; allowOutline?: boolean; presentation?: SchematicPreviewPresentation }) {
  const embedded = presentation?.kind === "embedded";
  const [view, setView] = useState<"outline" | "schematic">(allowOutline ? "outline" : "schematic");
  const [compare, setCompare] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [selected, setSelected] = useState<string>();
  const tabPrefix = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const assessment = useMemo(() => {
    try { return { projection: projectSchematic(source), error: null }; }
    catch { return { projection: null, error: "This sheet exceeds the preview limits or has invalid source data. The original drawing is unchanged." }; }
  }, [source]);
  const p = assessment.projection;
  const svg = useMemo(() => p ? renderPreviewSvg(p, view, selected) : "", [p, view, selected]);
  const outlineSvg = useMemo(() => p && compare ? renderPreviewSvg(p, "outline", selected) : "", [p, compare, selected]);
  const schematicSvg = useMemo(() => p && compare ? renderPreviewSvg(p, "schematic", selected) : "", [p, compare, selected]);
  if (!p) return <div role="alert" className={styles.notice}>{assessment.error}</div>;
  const download = () => {
    const url = URL.createObjectURL(new Blob([renderPreviewSvg(p, "schematic")], { type: "image/svg+xml" }));
    const a = document.createElement("a"); a.href = url; a.download = "schematic-preview-unverified.svg"; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const controls = <div className={embedded ? styles.embeddedControls : styles.controls} aria-label="Schematic preview controls">
        {allowOutline ? <label><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> Compare views</label> : null}
        <div className={styles.zoomControls}>
        <button className={embedded ? "icon-button h-9" : undefined} type="button" aria-label="Zoom out preview" disabled={zoom <= 50} onClick={() => setZoom(z => Math.max(50, z - 25))}>−</button>
        <button className={embedded ? "icon-button h-9" : undefined} type="button" aria-label="Fit preview width" onClick={() => setZoom(100)}>{zoom}% · Width</button>
        <button className={embedded ? "icon-button h-9" : undefined} type="button" aria-label="Zoom in preview" disabled={zoom >= 200} onClick={() => setZoom(z => Math.min(200, z + 25))}>+</button>
        </div>
        <button className={embedded ? "icon-button h-9" : undefined} type="button" onClick={download} disabled={!p.wires.length}>Download Preview SVG</button>
      </div>;

  return <section className={embedded ? `${styles.workspace} ${styles.embedded}` : styles.workspace} aria-label="Schematic conversion preview">
    {embedded ? <div className={styles.embeddedStatus}>
      <span>Read-only · Includes unsaved editor changes</span>
      <span className={styles.badge}>Not standards-verified · IEC review pending</span>
    </div> : <div className={styles.header}>
      <div><div className={styles.eyebrow}>{source.provenance === "example" ? "Standards & Assurance · Conversion Demonstrator" : "Current Drawing · Schematic Representation"}</div><h2 className={styles.title}>{source.title}</h2><p className={styles.subtitle}>{source.provenance === "example" ? "Synthetic example · Same circuit, two representations" : "Read-only view of the current sheet · Includes unsaved editor changes"}</p></div>
      <span className={styles.badge}>Not standards-verified</span>
    </div>}
    <div className={styles.notice}>General engineering conventions. IEC symbol references and presentation requirements await authoritative review. Not for construction.</div>
    {embedded ? (presentation.toolbarHost ? createPortal(controls, presentation.toolbarHost) : null) : <div className={styles.toolbar}>
      {allowOutline ? <div className={styles.tabs} role="tablist" aria-label="Circuit representation">
        {(["outline", "schematic"] as const).map((v, i) => <button key={v} ref={el => { tabRefs.current[i] = el; }} id={`${tabPrefix}-${v}`} role="tab" type="button" aria-selected={view === v} tabIndex={view === v ? 0 : -1} aria-controls={`${tabPrefix}-panel`} onClick={() => setView(v)} onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault(); const index = e.key === "Home" ? 0 : e.key === "End" ? 1 : 1 - i; setView(index ? "schematic" : "outline"); tabRefs.current[index]?.focus();
        }}>{v === "outline" ? "Outline View" : "Schematic Preview"}</button>)}
      </div> : <strong className={styles.subtitle}>Schematic Preview</strong>}
      {controls}
    </div>}
    {source.scopeNotes?.length ? <div className={styles.notice} data-testid="schematic-scope">{source.scopeNotes.map((note, i) => <p key={i}>{note}</p>)}</div> : null}
    <div className={styles.stats} role="status"><span>{p.nodes.length} devices</span><span>{p.terminalCount} terminals</span><span>{p.wires.length}/{source.wires.length} wires resolved</span><strong>{p.connectivityPreserved ? "Wire endpoint equivalence: verified" : "Wire endpoint equivalence: incomplete"}</strong><span>Symbol review: pending</span></div>
    <div id={`${tabPrefix}-panel`} role={allowOutline ? "tabpanel" : "region"} aria-labelledby={allowOutline ? `${tabPrefix}-${view}` : undefined} aria-label={allowOutline ? undefined : "Schematic drawing"} className={styles.paper} tabIndex={0}>
      {compare ? <div className={styles.compare} style={{ width: `${zoom}%` }}><div dangerouslySetInnerHTML={{ __html: outlineSvg }} /><div dangerouslySetInnerHTML={{ __html: schematicSvg }} /></div> : <div className={styles.single} style={{ width: `${zoom}%` }} dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
    <details className={styles.details} open><summary>Wire identity and endpoint comparison</summary><div className={styles.scroll}><table><thead><tr><th>Wire</th><th>Source terminal</th><th>Destination terminal</th><th>Projection</th></tr></thead><tbody>{source.wires.map((w, index) => {
      const projected = p.wires.find(pw => pw.id === w.id);
      return <tr key={`${w.id}-${index}`} className={selected === w.id ? styles.selected : undefined}><td><button className={styles.wireButton} type="button" aria-pressed={selected === w.id} onClick={() => setSelected(selected === w.id ? undefined : w.id)}>{w.label || w.id}</button></td><td>{projected?.fromLabel ?? `${w.from.placementId}:${w.from.anchorKey}`}</td><td>{projected?.toLabel ?? `${w.to.placementId}:${w.to.anchorKey}`}</td><td>{projected ? w.canonicalWireId ? "Same canonical endpoints" : "Same endpoints" : "Unresolved"}</td></tr>;
    })}</tbody></table></div></details>
    <details className={styles.details}><summary>Representation provenance and next review</summary><p className="mt-3 text-xs">{source.revision} · {p.representationRevision}. Original programmatic artwork; no normative symbol-entry identifiers assigned. Permanent continuity is shown only where explicitly declared in the source. Ratings, protection, clearances and circuit suitability are not assessed by this preview.</p><div className={styles.scroll}><table><thead><tr><th>Equipment</th><th>Asset / occurrence</th><th>Pinned version</th><th>Representation</th></tr></thead><tbody>{p.nodes.map((n, i) => <tr key={`${n.device.id}-${i}`}><td>{n.device.tag}</td><td>{n.device.assetId ?? "No managed asset"} / {n.device.id}</td><td>{n.device.versionId}</td><td>{n.device.kind === "generic" ? "Generic block — mapping needed" : "Candidate — source review pending"}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs">Next: review exact symbol choices, terminal correspondence, designation rules and sheet presentation in Standards &amp; Assurance. Previewing does not record approval or passing standards evidence.</p></details>
    {p.issues.length ? <div className={styles.issues}><strong>Open projection issues ({p.issues.length})</strong><ul>{p.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></div> : null}
  </section>;
}

