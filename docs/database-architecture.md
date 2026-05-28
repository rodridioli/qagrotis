# Database Architecture Notes

> Last updated: 2026-05-27

---

## prisma-schema-ensure.ts — Runtime DDL Guard

### Why it exists

Vercel and Neon deployments receive the database URL only at **runtime**, not at build time.
This means `prisma migrate deploy` cannot run during the build step.
When Prisma's generated client expects a column that doesn't exist in the live database, the first query throws and breaks the page.

`src/core/prisma-schema-ensure.ts` provides idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` guards.
Each guard is called once per process lifetime (via a `globalThis` flag) from the Server Action that first needs the column.

### Pattern

```ts
const g = globalThis as unknown as { __qagrotisEnsuredXxx?: boolean }

export async function ensureXxxColumns(): Promise<void> {
  if (g.__qagrotisEnsuredXxx) return
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Foo" ADD COLUMN IF NOT EXISTS "bar" TEXT`)
    g.__qagrotisEnsuredXxx = true
  } catch (e) {
    console.error("[prisma-schema-ensure] xxx", e)
  }
}
```

### When to add a new guard

Every time you add a new column or table via a migration **and** you cannot guarantee `prisma migrate deploy` runs before the first request, add a matching guard here and call it from the relevant Server Action.

### Wiring rule

Call the ensure from **both** the primary list action (e.g. `getSistemas`) **and** any write action (create/update) that touches the guarded table. This guarantees the column exists regardless of which path the first request hits. The `globalThis` flag makes all calls after the first one free (O(1) check — no DB round-trip).

### Long-term exit

Once the team adopts a deploy pipeline that runs `prisma migrate deploy` reliably (e.g. a Vercel build command or a GitHub Actions step), this file can be removed incrementally — one guard at a time as each column is confirmed present in all environments.

---

## CreatedUser vs UserProfile — Dual-Model Design

### Why two models?

| Model | Purpose |
|---|---|
| `CreatedUser` | The authoritative identity record. Created by an admin. Holds email, password hash, invite state, and basic RBAC fields (`type`, `accessProfile`). |
| `UserProfile` | Extended profile data (schedule, photo, classification, etc.). Created lazily on first profile edit. Never used for auth decisions. |

This split allows Auth.js (which manages its own `User` / `Account` / `Session` tables) to co-exist without conflicting with application-level user data. The `CreatedUser.id` becomes the stable anchor for all FK references in the app.

### Consolidation risk

Merging these two models would require a single migration touching nearly every FK in the schema. The duplication is intentional and documented — do not merge without a full impact analysis.

---

## Suite.cenarios and Suite.historico — JSON Blob Growth

Both `Suite.cenarios` and `Suite.historico` are stored as `Json` columns (PostgreSQL `jsonb`).

| Column | Contents | Growth profile |
|---|---|---|
| `cenarios` | Array of `{ id, scenarioName, … }` snapshots | Bounded by the number of cenários in a suite (typically < 200) |
| `historico` | Array of execution history entries, one per run | **Unbounded** — grows with every suite execution |

### Risk

As suites accumulate execution history, `historico` blobs can grow into the MB range.
Queries that load `Suite.historico` for many suites simultaneously (e.g. `getCenarios`, which aggregates all active suites) will put increasing pressure on memory and I/O.

### Mitigation options (future work)

1. **Trim historico on write** — keep only the last N entries (e.g. 100) per suite when a new execution is appended.
2. **Move historico to a dedicated table** — `SuiteExecution { id, suiteId, executedAt, results Json }` with an index on `suiteId`. This enables pagination and efficient aggregation.
3. **Archive old entries** — periodically move historico entries older than X months to a cold-storage table.

Current threshold to act: monitor suite row sizes; intervene when any suite's `historico` exceeds ~500 KB.

---

## Encryption of Sensitive Fields

All sensitive credentials stored in the database use AES-256-GCM encryption via
`encryptField` / `decryptField` in `src/core/db-utils.ts`.

### Encrypted fields

| Table | Column | Notes |
|---|---|---|
| `Cenario` | `senhaTeste`, `senhaFalsa` | Encrypted on write in `criarCenario` / `atualizarCenario` |
| `Credencial` | `senha` | Encrypted on write in credencial actions |
| `JiraCredentials` | `apiToken` | Encrypted in `jira-credentials-db.ts` |
| `ClockworkCredentials` | `apiToken` | Encrypted in `clockwork-credentials-db.ts` |
| `Integracao` | `apiKey` | Encrypted in integracao actions |

### Backward compatibility

`decryptField` returns the input unchanged if it does not start with the `enc:v1:` prefix.
This makes it safe to add decryption to queries that may still have plaintext values from
before encryption was introduced — no bulk migration required.

### Key management

Set `ENCRYPTION_KEY` to a 64-character hex string (32 bytes).
In production this must be present or the app will throw on startup.
In development a warning is logged and a fallback key is used.

---

## Removed: QaUser

The `QaUser` model was a legacy table with no application code referencing `prisma.qaUser`.
It was superseded by `CreatedUser` + `UserProfile` and dropped in migration
`20260527150000_drop_qa_user`.
