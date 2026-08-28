# Drawing Terminal Blocks

`drawing_terminal_blocks` owns structured terminal-strip member schemas,
validation, physical composition, terminal projection, rendering, and the shared
Terminal Strip Builder.

## Structured terminal strips

A new terminal strip is one managed drawing asset. Its ordered members are
nested records and never become independent Asset Manager entries. Each member
pins an exact Registry symbol version and has:

- a permanent, monotonically allocated token such as `M03`;
- a read-only electrical order number derived from member position;
- optional typed engineering attributes, keyed to the permanent member token;
- a legacy engineering description fallback for existing drawings;
- optional recursive installed-component selections.

Permanent tokens provide canonical terminal identity. A raw member terminal
`1` on member `M03` projects as `M03.1`; reordering the member or changing its
visible order does not change that identity.

The `members` array remains authoritative for physical presentation, composed
SVG geometry, visible terminal order, and BOM order. Permanent member tokens
remain stable within one strip's lifecycle, but they must not be used to infer
electrical equivalence or recreate wiring between different physical strip
assets. Wiring is created and validated explicitly against canonical endpoints.

Member eligibility is explicit Registry metadata:

```ts
type SymbolTerminalStripCapability = {
  role: "electrical" | "end_bracket" | "accessory";
  railDatumMm: number;
  defaultForNewStrips?: boolean;
};
```

Eligible symbols must be DIN-rail mounted, panel-layout capable, physically
sized, and have a valid rail datum. Electrical members require resolved
terminals; brackets and accessories cannot expose terminals. Exactly one
approved electrical symbol and one approved end bracket may be configured as
defaults. New strips start with one bracket, five electrical members, and one
bracket.

Composition uses the exact physical width and height of every pinned symbol.
Members share the Registry-defined DIN-rail datum and SVG artwork is uniformly
scaled with `preserveAspectRatio="xMidYMid meet"`; the builder and every drawing
rendering surface use the same geometry and generated SVG.

The builder supports create and shared edit modes. Reuse is deliberately kept
outside composition editing and is launched from **Reuse terminal strip** in
Properties. **Copy as new terminal strip** clones the composition into a new
physical asset and tag without wiring. **Place another representation** reuses
the same physical identity and occupancy; mounted representations are permitted
only when the physical panel/backplane context resolves unambiguously. Generic
clipboard paste rejects structured strips so this identity choice is never
implicit. Shared edits validate connected terminal compatibility, all occurrence
bounds, and backplane collisions before committing one drawing-history
operation. Member BOM templates and installed components expand recursively
under the parent strip tag.

## Member engineering attributes

Each structured member may carry an Engineering Attributes container. The
permanent member token plus attribute definition key is the analytical identity;
visible order, designation, description, and screen position are never identity.
All current controlled definitions are available in the builder's member
Specifications dialog. Purpose resolves from the controlled
`engineering_purpose` value first and the legacy member description second.
Explicit Purpose edits retire that member's legacy field without rewriting other
members on load.

Reordering and shared representations preserve member facts. Replacing a pinned
product retains Purpose but clears technical ratings. New member and new-strip
copies apply definition copy policies, so technical ratings copy while Purpose
does not. Terminal hover and Properties are read-only projections of these
facts; individual raw terminal sides do not own attributes in this release.

## Legacy count-based groups

The earlier `modular_terminal_strip` representation remains parseable and
renderable for compatibility. It is read-only in Properties and can be deleted,
but it cannot be created, resized, converted, or referenced by the structured
builder. Engineers intentionally delete and recreate those groups.

Focused verification:

```powershell
npm run test -- src/features/drawing_terminal_blocks/tests
npm run test -- src/features/drawing_canvas/tests/drawing-structured-terminal-strip-commands.test.ts
npm run test -- src/features/drawing_canvas/tests/drawing-structured-terminal-strip-reuse.test.ts
npm run test -- src/features/drawing_panel_wiring/tests
npm run test -- src/features/bom_creator/tests
```
