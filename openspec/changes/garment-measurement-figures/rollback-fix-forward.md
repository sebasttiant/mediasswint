# Rollback and Fix-Forward Runbook

## Compatibility Floor

The minimum compatible application commit is
`dc3fae5771e8f8bb01ecb81634b2b4bc59b9f6dd`.

It is valid in the reconstructed lineage: it exists, is an ancestor of the
candidate, and contains all three required seams:

1. `isActive` schema semantics for templates, sections, and fields;
2. deactivation of no-longer-declared rows during template synchronization;
3. active-only template snapshot projection in `getActiveTemplateSnapshot`.

The validation command is:

```bash
git cat-file -e dc3fae5771e8f8bb01ecb81634b2b4bc59b9f6dd^{commit}
git grep -n -e isActive -e getActiveTemplateSnapshot dc3fae5 -- \
  apps/web/lib/measurement-templates.ts apps/web/lib/measurements.ts apps/web/prisma/schema.prisma
```

## Prohibited Rollback Targets

Never roll back this feature to `847e90e` or any earlier commit. Those targets
pre-date the deactivation schema and can project stale active rows into new
snapshots. Do not select a target merely because it predates a UI change.

## Procedure

1. Stop new deployments and preserve the incident evidence.
2. Confirm the target is `dc3fae5` or a later commit that passes the compatibility
   checks above.
3. Prefer a forward fix for a route, shell, or renderer defect; snapshots are
   immutable clinical records and must not be rewritten as a rollback shortcut.
4. If an application rollback is unavoidable, deploy only a validated compatible
   target, run Prisma validation, and create a new draft to prove its snapshot
   contains only active sections and fields.
5. Record the deployment target, migration state, and audit reconciliation result.
