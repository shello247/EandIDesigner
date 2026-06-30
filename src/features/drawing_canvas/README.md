# Drawing Canvas

Model-driven engineering drawing workspace.

The canvas stores structured drawing JSON and renders deterministic SVG sheets
from approved registry symbols. V1 supports a single A3 landscape sheet,
approved symbol placements, semantic anchor-to-anchor connections, manual
orthogonal route editing, save, and approval.

Validation remains part of save and approval, but it is not exposed as a
standalone drawing action. Drawing export and archive are not exposed in the
current drawing workflow.

## Test

```powershell
npm run test -- drawing_canvas
```
