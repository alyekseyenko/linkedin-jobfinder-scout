# habitarmos-phc-replica (public summary for Neural Scout)

Read-only PHC (SQL Server) → PostgreSQL (VPS) replica for n8n and internal apps. Outbound-only sync agent on company PC; ERP not exposed to the internet.

## Production metrics (measured on the VPS, 2026-10-16)

- In production since 2026-10-12; 2 tenants (HabitArmos, Estores Rainha)
- PHC tables inventoried (metadata): ~7.8k + ~7.0k
- Entities synced per tenant: 7 (`st`, `cl`, `ft`, `fi`, `bo`, `bi`, `cc`)
- Rows replicated: ~1.43M (raw layer, both tenants)
- Customers on replica: 11,490 (Estores) / 4,720 (HabitArmos)
- Incremental sync: every 15 min, ~5 s median run, 99.1% success over 7 days
- Daily reconciliation vs PHC: count delta at or below 0.5%; HabitArmos customers exact match
- Automated quality checks: ~12k per week (raw → staging → curated)
- Twenty CRM: 11,377 Estores customers mapped
- PHC batch size: 400 rows

## Stack (non-secret)

Python, T-SQL, PostgreSQL, JSONB raw layer, staging views + curated tables, Docker, n8n, Twenty CRM (GraphQL), Zoho Bigin, SSH, Discord observability.

## Repo layout

- `agent/` — discovery and sync agent
- `docs/` — data dictionary, CV notes, runbooks
- `migrations/` — versioned SQL

Local full repo path is never committed; use `node scripts/ingest_local_repo.js` on your machine.
