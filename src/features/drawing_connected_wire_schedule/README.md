# Connected Wire Schedule

This feature projects canonical field connections and internal panel wires into a
read-only drawing table linked to one managed equipment occurrence. The table is
stored as a version-2 drawing annotation; wire records, routes, patterns, and
terminal occupancy remain owned by the wiring features.

The schedule follows the linked occurrence's Connection Display mode:
sheet-routes, internal wires, external connections, or both. Its legacy `scope`
field remains synchronized for compatibility but is not a second source of
truth. Internal wire specifications come from their stored Wire Catalog
snapshot. Field connections fall back to cable tag and conductor key. Schedule
height is derived from wrapped rows, while engineers may move the table and
adjust its width.

Selecting a schedule exposes cyan internal dividers. Dragging a divider changes
only its two neighboring columns while keeping the table width fixed. The
right-edge handle continues to resize the complete table and preserves the
saved column proportions. Column ratios are additive annotation data and can
be reset to the default layout from Properties.

From and To cells retain the compact `Tag:Terminal` identity as their primary
line. A smaller secondary line is derived from the managed equipment title and
the registered terminal label/function, so engineers can identify both ends
without changing or duplicating any wire data.

The schedule is distinct from graphical wire routes and off-sheet reference
stubs: it is a derived report only and never creates connectivity. Field wires
without a number show an em dash. Their specification falls back to cable tag
and conductor, and their description remains blank when the connection has no
label.

## Pagination and continuation sheets

Connected Wire Schedules on Detailed Panel sheets can be divided into a
continuation set. Part 1 owns the continuation settings. Every part references
the same managed asset and panel, retains the source occurrence display mode,
sorts the selected canonical wire rows once, and renders a unique slice of that
ordered result.
Rows are never persisted in drawing JSON and no wire, route, occupancy, pattern,
mapping, or asset record is copied.

Properties recommends the largest row count that fits the reviewed table
position and width using the actual wrapped row heights. Engineers may choose a
smaller value. Horizontal overflow must be corrected on Part 1 before pages can
be created. Canvas, Package Preview, print, PDF, and exported SVG use the same
renderer and display both `Part X of Y` and `Rows A–B of N`.

Synchronization is atomic. It updates all existing parts, creates missing
parts, and removes surplus sheets only when they still contain exactly the
generated asset occurrence and continuation schedule. A renamed sheet, note,
extra placement, connection, or any other user customization blocks cleanup so
no authored work is lost. Removing pagination follows the same safe-cleanup
rule. Legacy schedules without pagination remain unchanged.

Run:

```powershell
npm run test -- src/features/drawing_connected_wire_schedule/tests
```
