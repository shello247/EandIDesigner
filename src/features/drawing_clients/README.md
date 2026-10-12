# Drawing Clients

Provides lightweight, reusable Client identities for Project assignment. Client names are case-insensitively unique. The initial surface supports listing and creation through the Project form; broader Client administration is intentionally deferred.

All validation is Zod-backed, database access remains under `data/`, and the Add Client dialog is mounted only while requested.

## Verification

```powershell
npm run test -- src/features/drawing_clients/tests/drawing-clients.test.ts
```
