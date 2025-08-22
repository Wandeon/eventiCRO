# New UI preview (non-destructive)

This PR adds a self-contained mobile UI shell under `/new/*` without changing existing routes/layouts/hooks.

Preview after `npm run dev`:

- `/new/explore`
- `/new/organizers`
- `/new/map`
- `/new/wallet`
- `/new/more`

No dependencies added. All styles are scoped to `.newui` to avoid conflicts.
