# Drawing Projects

Drawing Projects organize related drawing packages without changing their engineering document model or printable title blocks.

## Responsibilities

- Validate Project identity and lifecycle contracts with Zod.
- Store and query active/archived Projects through the feature data layer.
- Return 25-row Project and linked-drawing summaries without selecting `Drawing.modelJson`.
- Allocate immutable, unique `PRJ-######` Project numbers on the server.
- Validate reusable Client assignments while retaining a Client-name snapshot for existing drawing consumers.
- Allow active assignments, unassignment, and compatibility with a drawing's already-linked archived Project.
- Provide the Project register, creation/detail forms, archive/restore controls, and reusable assignment summaries.

## Boundaries

- `Drawing.projectId` is organizational membership.
- `Project.clientId` is the reusable Client identity; `Project.client` is a compatibility/display snapshot updated only when the Project selection changes.
- `Drawing.modelJson.titleBlock.project` and `.client` control printed output.
- New assigned drawings initialize blank printed fields once. Later Project edits or drawing reassignment never rewrite the title block implicitly.
- Client administration beyond creation, Project deletion, access control, shared editing, project templates, and configurable numbering schemes are deferred.

Public Zod contracts and lightweight types are exported from `api/public.ts`. Server-only queries and use cases are exported from `api/server.ts`; UI and other features must not import internal data modules directly.
