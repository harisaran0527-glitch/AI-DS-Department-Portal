# Codex security implementation and validation

Completed locally on 2026-10-21 in `HOD-Codex`, based on preservation checkpoint `e63f582a9752792e1eab9c72021d5cba5841e807`.

## Changes

- Removed the legacy browser database's automatic Admin/HOD account creation. The recovered backend initializer already created only schema/configuration; regression tests now enforce that neither initializer seeds users or changes existing password hashes.
- Fixed a separate local startup race: schema initialization now waits for the asynchronous SQLite driver, uses its live binding, and completes before the HTTP listener or synchronization scheduler starts. Driver failure prevents local startup. The existing serverless rule that skips startup schema initialization remains intact.
- Removed built-in student password defaults and the prefilled Admin import password. Faculty creation requires an explicit password. New roster accounts receive random, undisclosed passwords and require an authorized reset before first use; synchronization preserves existing hashes.
- Login forms start with empty credentials, reset when their portal role changes, use distinct field names, and request suppression of automatic credential filling. They never restore remembered identifiers into fields or store passwords. Persistent browser token storage now requires explicit “remember device” consent.
- JWT signing requires a configured private key of at least 32 bytes in every runtime. Public fallback and placeholder keys fail closed. Verification pins HS256, issuer, audience, subject, expiration, token ID and bounded lifetime. This follows the library's [documented verification options](https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback).
- Every authenticated request rechecks the authoritative account's current role, active status and password fingerprint. Password changes invalidate previously issued sessions without a credential migration. Authentication never falls back to a disconnected database.
- Logout persists a SHA-256 token digest in the existing `sessions_revocation` table. Replays are rejected; other tokens remain valid. Revocation outages return an error instead of claiming success. See [OWASP's session termination guidance](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
- Cookies remain role scoped and HttpOnly, use SameSite=Lax, and are Secure in production. Cookie-authenticated mutations require a trusted origin; ambiguous shared requests require a portal role. CORS no longer trusts arbitrary `*.vercel.app` origins. Internal server errors do not expose infrastructure details to clients.
- JWTs are no longer accepted in query parameters. Eight certificate/participation view/download actions now fetch authenticated bytes and use blob URLs. Private proof responses and client fetches disable caching. Student proof access is retained while unrelated faculty and other students are denied.
- Discipline queries deny missing or invalid staff scopes, bypass cached assignments, and retain owner/exact active-class restrictions. Deletion checks current ownership/assignment within the delete statement. Client-supplied role, student ID and staff-attribution fields cannot override authoritative values.
- Closed two additional verified authorization gaps: Student sessions cannot use other faculty operations, and department-wide SkillEdge synchronization requires HOD/Admin authentication. SkillEdge ingestion requires its separately configured secret in every runtime; its shared default was removed.
- Resolved all 79 original frontend diagnostics by removing unused imports, unused state bindings and unreachable handlers. Compiler checks remain enabled. Added strict backend checking and resolved 119 additional diagnostics, primarily by validating Express 5 named route parameters as scalar strings and correcting nullable/binary types.

## Actual validation

| Check | Result |
| --- | --- |
| `npm.cmd test` | 74 passed; 0 failed, skipped or cancelled |
| `npm.cmd run typecheck` | Frontend project and strict backend/API checks pass with zero diagnostics |
| `npm.cmd run check:server` | 28 server/API TypeScript files; zero syntax errors |
| `npm.cmd run build` | Production client build passes |
| Oxlint on modified/new source and test files | 0 errors; 52 warnings |
| `git diff --check` | Passes |

The portable test runner removes inherited live credentials, endpoints, dotenv overrides and preload hooks. Fixtures use memory-only account/data stores, mocked service/database adapters, loopback HTTP listeners and static React rendering. The real asynchronous SQLite startup path is tested with an in-memory native-driver substitute; it creates no database file. Production databases, historical database exports, uploaded files and existing credentials were not used for testing or changed. These checks do not constitute live PostgreSQL, Gemini or browser end-to-end verification.

Logs remain local in `.parallel-local/tests-final.log`, `typecheck-final.log`, `build-final.log` and `lint-final.log`.

## Final integration considerations

- Original main and `HOD-Antigravity` source folders were not edited. The original preservation checkpoint remains intact. All source implementation and testing occurred in `HOD-Codex`; no push, main merge, production connection, production migration or deployment was performed.
- Current JWTs from the previous token format will require a fresh login after a later approved release. Existing user accounts, identifiers and password hashes are preserved. New roster-account onboarding requires an authorized password reset; register-number passwords are no longer generated.
- Before any approved release, verify the existing `sessions_revocation` table and strong private signing key on the primary database/environment. Missing configuration fails closed. Configure the actual frontend origin explicitly when necessary and use the same-origin API proxy for the SameSite=Lax cookie flow. If ingestion is used, provision a separate strong SkillEdge sync token. No secret was generated for production or rotated during this task.
- The build retains a large-chunk warning: approximately 2.11 MB JavaScript before gzip (494 KB gzip). Antigravity's performance work can address it. Lint warnings include effect/dependency and unused-code advisories; no lint errors remain in the checked files.
- Compare both agents with the shared checkpoint during integration. Review overlapping files, especially `server/db.ts`, `server/postgresAdapter.ts`, faculty/file routes, `src/services/api.ts` and shared TSX components. PostgreSQL SSL settings and Gemini implementation were not changed by this task; the adapter edit only adds SQLite readiness handling.
- Historical data files already tracked by Git remain unchanged. Review existing tracked exports separately during the final repository/security review; this task neither deletes them nor adds new data exports.

Final GitHub push and production deployment still require the user's separate approval after both agents finish and integration/regression/configuration reviews are complete.

## Isolated integration follow-up (2026-10-21)

The following verification supersedes the source-worktree and test-count statements above for branch `integration/final-hod-portal-20261021` in the separate `HOD-Integration` worktree:

- Integrated the committed Codex security work and Antigravity Discipline implementation. The main, HOD-Codex, and HOD-Antigravity worktrees remain on their original commits; pending source-worktree changes were preserved and not copied wholesale over the stronger Codex authorization implementation.
- Primary PostgreSQL and SkillEdge Neon connections now force `sslmode=verify-full` and certificate/hostname verification. A configuration that attempts to disable Neon verification fails closed. Supabase's separate connection behavior is unchanged.
- Added an idempotent Discipline `status` migration test against isolated in-memory SQLite records. Existing rows are preserved and default to `OPEN`; no production database was contacted or migrated.
- Fixed the Student AI Reward client to use the authenticated self endpoint and canonicalized the register number from the student database row. The student dashboard suppresses scores, ranks and generated score explanations when no database-derived academic evidence exists. HOD/faculty CSV and XLSX templates contain headers only, and missing attendance is displayed as unavailable rather than as a synthetic percentage.
- Removed synthetic academic, team-head, representative and missing-LeetCode-rating score defaults. Missing SkillEdge levels now remain `Unknown`; an unmatched live SkillEdge record is reported as `NOT_LINKED` without writing zeros over the existing record.
- Integration validation: `npm.cmd test` passed 88/88; `npm.cmd run typecheck` passed; `npm.cmd run check:server` parsed 29 files with zero syntax errors; and `npm.cmd run build` passed with the existing large-chunk warning (1.55 MB minified JavaScript). Focused Oxlint reported zero errors and existing warnings. `git diff --check` passed.
- Test fixtures, build and type checks are isolated from production data. These results do not establish live Neon connectivity, production secret configuration, browser end-to-end behavior, or live role logins.

Deployment remains **NO-GO** pending final integration approval, explicit production JWT configuration/origin review, live environment verification, and any required migration approval. No push, main merge, production migration, production record modification, or deployment was performed.
