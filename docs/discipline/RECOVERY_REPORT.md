# Discipline security recovery and production authentication diagnosis

Date: 21 October 2026 (Asia/Kolkata). Scope: local backend security recovery, isolated verification, and authorized read-only production investigation. No production records were created, updated, deleted, reset, or migrated by this recovery.

**Result:** missing Discipline security implementation restored and tested locally. The original production startup failure is confirmed from Vercel logs and is already repaired in the current deployed commit. **The new security changes are not ready to deploy while the approved production JWT signing secret is absent.** No commit, push, or deployment was performed by this recovery.

## 1. Existing work protected

The working tree, staged diff, recent history, previous implementation report, existing routes, middleware, database guards, and tests were inspected before editing. The owner's single-writer authorization was applied to the affected backend files. No reset, restore, clean, force-push, seeder, account creation, password reset, or migration was run.

The original two-line `server/db.ts` syntax fix was staged at the initial recovery inspection. Commit `51b7fb5c489dbcc935e97623fee77fc2a4d355cd` subsequently appeared in local history and remote main with exactly that fix. This recovery did not create or push that commit. Its existing fix was preserved; the only additional database change here tightens the Discipline query scope.

Existing frontend, deployment example, migration-planner, database-policy, adapter-guard, and documentation work remains. Existing auth-check scripts were not overwritten or executed. Tests use new, separate files and in-memory fixtures.

## 2. Security restored

- Reconstructed `createDisciplineRouter` from the existing API, repository methods, middleware, and preserved security tests. `server/routes/discipline.ts` now connects that router to the real dependencies and `withPrimaryDatabase`.
- Every Discipline route requires JWT authentication and Faculty, HOD, or Admin authorization. Anonymous users and Student sessions cannot use the staff Discipline API.
- Current staff identity, role, and active status are checked against the authoritative user row. Stale/deactivated accounts fail closed; audit attribution uses the current user name/email.
- Lookup, autocomplete, and record creation enforce faculty ownership/workspace or an active exact year/section assignment. Missing, inactive, and wildcard assignments do not imply unrestricted access. HOD/Admin retain existing department-wide behavior.
- Record list filters always use the authenticated staff ID/role, ignoring caller-supplied role or faculty identity. Deletion checks the record is visible in that authenticated scope before invoking the existing deletion method. No live records were deleted for validation.
- The real repository SQL no longer matches unrelated students with blank year/section when a faculty member has no assignment. This is covered by real SQL tests against an isolated in-memory database.
- Existing `/records`, `/lookup-student/:regNo`, and `/students/search` response shapes are retained. Private responses use `Cache-Control: no-store`.
- Form types, incident date/time, text size, and non-negative finite fine values are validated. Database failures return generic JSON rather than infrastructure details.
- Existing primary-database guards are now active for Discipline requests. Tests verify reads do not fall back to a disconnected SQLite copy and writes are attempted once after an ambiguous failure. Unrelated requests retain their existing fallback behavior.
- A separately failing audit write no longer makes an already-persisted Discipline record appear unsaved. This avoids inviting a duplicate retry after a successful insert. Persistent cross-request idempotency keys are not claimed.

The authentication middleware's route-role inference now matches actual portal prefixes. `/api/discipline/students/search` is a shared staff route rather than being mistaken for the Student Portal. Real-cookie integration tests cover Faculty/HOD/Admin without requiring a bearer token.

Login now validates credential types/role names, uses the authoritative database policy, and returns generic HTTP 503 for dependency failures. A login session cookie is issued only after the required login audit succeeds. Existing secrets, hashing, password values, role-specific cookies, and account records are preserved.

Production authentication now refuses to issue or verify tokens using the source-code fallback when `JWT_SECRET` is absent. This does not generate or rotate a key. Existing configured secrets are used unchanged. Development behavior remains compatible with the existing local configuration.

## 3. Confirmed production HTTP 500 root cause

Vercel authentication was verified with `npx.cmd vercel whoami`. The real project root is the nested checkout containing `package.json`, `server/`, and `vercel.json`.

The existing project was identified through deployment inspection and project listing, then linked explicitly:

```powershell
npx.cmd vercel link --yes --team saran16 --project aids-department-portal
```

This linked the existing `saran16/aids-department-portal`; no new project was created. Vercel confirms that `https://aidsportal.vercel.app/` aliases this project.

| Evidence | Confirmed result |
| --- | --- |
| Earlier failing deployment | `dpl_DYhnohDoni7aSThoHuKyESNaqTky` |
| Earlier deployed Git SHA | `5e5b1803111ecbbe2151bde2758b3b267f8a2e2c` |
| Runtime logs, 10:18:21 and 10:18:41 IST | `SyntaxError: Illegal return statement` during `/api/health` invocation |
| CDN request records for those invocations | HTTP 500 |
| Exact source defect | Duplicate `return true;` and closing brace in `server/db.ts` near old line 2683, outside the intended method/class structure |
| Parsing old source | 1207 cascading TypeScript syntax diagnostics |
| Current production deployment | `dpl_6mmMGP3gKNdo7kQbpmNU1Si5JCgb`, Ready, created 10:33:04 IST |
| Current deployed Git SHA | `51b7fb5c489dbcc935e97623fee77fc2a4d355cd` |
| Fix diff | Removes the two stray lines; database source parses with zero syntax diagnostics |

The backend could not load, so all portal login routes sharing that Express entry were affected before authentication logic could run. The optional Discipline router was not the cause of this startup failure. A frontend-only Vite build had passed without checking backend syntax.

The current production deployment already contains the syntax fix, independently of these new local security changes. Final credential-free probes passed: `/api/health` returned **200**, and an empty POST to `/api/auth/login` returned the expected **400** with JSON.

Retained production request records contained 15 successful login responses (200), 8 rejected credentials/session attempts (401), and 2 validation responses (400), with no login 500 in that sampled window. The records do not identify the role, so they are **not** claimed as four-role production smoke tests performed by this recovery. Successful requests provide evidence the deployed authentication database path operated at those times; they do not establish it uses the same connection as local `.env`.

The two-hour log query was rejected because this plan's retention does not support that range. The supported 30-minute query succeeded and retained the original failure. These startup exceptions were classified as info-level runtime entries, so inspecting all entries for the failing deployment was necessary. Current error-level entries inspected were Node/connection-library warnings, not the historical syntax exception.

## 4. Environment and deployment blocker

Production environment names were inspected without reading or printing their values:

```text
ADMIN_EMAIL
USE_SQLITE
DATABASE_URL
VITE_API_BASE_URL
```

**`JWT_SECRET` is absent from Production.** The current deployed code falls back to a public source-code value. The recovered local code refuses that fallback in production. Therefore deploying these changes before configuring the owner's approved signing key would return HTTP 503 for authentication.

No signing key, Gemini key, password, or database credential was generated, replaced, uploaded, or reset. The owner must supply the approved production signing-key configuration through Vercel's secure environment settings before promotion. Existing session impact must be reviewed against that approved key; this recovery does not choose a new value or promise unchanged sessions after configuration.

`vercel link` generated ignored `.vercel/project.json` and `.env.local` with a CLI OIDC token. Neither was printed or staged. Its redundant `.gitignore` additions were removed while retaining the original ignore rules; both generated paths are ignored. Existing `.env` and `.env.example` contents were not edited by this recovery.

## 5. Verification

| Check | Result |
| --- | --- |
| Backend syntax | Pass: 27 server/API TypeScript files, zero syntax errors |
| Discipline route tests | Pass: 14 tests |
| Database guard tests | Pass: 4 tests with isolated driver substitutes |
| Real repository scope SQL | Pass: 4 tests against in-memory SQLite, with application bootstrap disabled |
| Offline reconciliation | Pass: 5 tests; no actual migration |
| Real authentication route/middleware tests | Pass: 8 tests, including successful login/logout/session isolation for Student/Faculty/HOD/Admin using memory-only accounts |
| Total local tests | **35 passed, zero failed** |
| Frontend production build | Pass; existing large-chunk warning remains |
| Backend semantic TypeScript check | Not clean: 10 existing diagnostics in `server/db.ts` and `server/scoringEngine.ts` |
| Backend baseline comparison | Same 10 diagnostics in HEAD and working tree; zero newly introduced diagnostics |
| Git whitespace/conflict checks | `git diff --check` passed; no unmerged index entries |
| Configured PostgreSQL connectivity | Pass, direct read-only audit before and after tests |
| Final production health | Pass: 200 JSON |
| Final production empty-login validation | Pass: 400 JSON |
| Positive four-role production smoke test performed here | Not run; authorized account credentials/sessions were not provided for this recovery |

Reproducible local commands:

```powershell
npm.cmd run check:server
npm.cmd run test:discipline
npm.cmd run test:auth
npm.cmd run build
```

`vercel.json` now runs `npm run check:server && npm run build` before deployment so the original backend syntax failure cannot be hidden by a successful frontend build.

## 6. Original data integrity

Read-only configured-database audits before and after local testing matched:

| Table/check | Before | After |
| --- | ---: | ---: |
| Students | 2 | 2 |
| Users | 4 | 4 |
| Faculty assignments | 1 | 1 |
| Discipline records | 0 | 0 |
| Duplicate register-number groups | 0 | 0 |
| Orphan discipline records | 0 | 0 |

Configured-database roles remain 1 Admin, 1 Faculty, 2 Students, and no HOD account. These are local-configured destination facts, not an assumed inventory of the production database.

No actual student/faculty/admin/HOD/academic/discipline records were inserted, updated, deleted, regenerated, or migrated by the recovery. Production seeders were not run. Passwords and account hashes were not altered. All synthetic identities and incidents existed only in test-worker memory or an explicit `:memory:` database. Counts are not a full record-content checksum reconciliation, and no source migration or backup completion is claimed.

Audit outputs, production metadata, and raw logs remain under ignored `scratch/`; they must not be included in a commit.

## 7. Exact recovery files changed or created

| File | Recovery change |
| --- | --- |
| `server/routes/discipline.ts` | Replaced optional-auth router with the real guarded factory wiring |
| `server/routes/disciplineRouter.ts` | Restored implementation; live account checks, RBAC, faculty scope, validation, error handling |
| `server/middleware/auth.ts` | Corrected portal-prefix inference and added production signing-key availability check |
| `server/routes/auth.ts` | Credential validation, authoritative database policy, generic failures, cookie issuance after audit, missing-secret guard |
| `server/db.ts` | Tightened Discipline SQL assignment predicate; preserved the now-committed syntax fix |
| `package.json` | Added `test:auth`; preserved previous Discipline/syntax scripts |
| `vercel.json` | Added backend syntax check before frontend build |
| `tests/discipline-routes.test.mjs` | Repaired fixture accounts for current-role validation; added assignment, active-account, successful mutation, and scope-spoofing cases |
| `tests/authentication.test.mjs` | Real-handler four-role tests with isolated repository, failure, cookie, and configuration cases |
| `tests/discipline-database.test.mjs` | Primary-only read/write/fallback behavior tests |
| `tests/discipline-scope.test.mjs` | Real repository SQL scope tests against memory-only data |
| `tests/helpers/isolated-server.mjs` | Worker-local loader preventing environment-file loading, live repository access, and bootstrap in handler tests |
| `scripts/check-production-auth.mjs` | Credential-free health and validation probes |
| `scripts/inspect-auth-deployment.mjs` | Public commit/source syntax inspection without printing source or credentials |
| `docs/discipline/RECOVERY_REPORT.md` | This recovery result, evidence, limitations, and deployment plan |
| `docs/discipline/IMPLEMENTATION_REPORT.md` | Added pointer to the newer recovery status; historical findings retained |
| `docs/discipline/ACCESS_AND_DEPLOYMENT.md` | Added pointer to verified CLI linkage and deployment diagnosis |

`server/databasePolicy.ts` and the existing `server/postgresAdapter.ts` guards are required dependencies preserved from the earlier work, rather than recreated here. Prior frontend changes and all legitimate pending artifacts remain separate from these recovery edits. No existing auth-check script was changed.

## 8. Safe commit and deployment plan

1. Keep this checkout under one backend writer. Use current main `51b7fb5` as the reviewed base; its production syntax repair is already present and should not be reapplied or overwritten.
2. Resolve the production `JWT_SECRET` configuration using the owner's approved value through a secure account/environment workflow. Do not generate, disclose, or rotate a key implicitly. Do not deploy before this is resolved.
3. Review the exact recovery diff and required existing policy/adapter dependencies. Review prior frontend integration separately. Include only intended source, scripts, and tests; exclude `.env`, `.env.local`, `.vercel`, scratch outputs, logs, exports, and databases.
4. Address the known baseline semantic type-check failures under a reviewed scope, or explicitly resolve the project's release gate. Preserve unrelated academic functionality while doing so.
5. Run syntax, Discipline, auth, reconciliation, and frontend-build checks. Validate a preview against an isolated approved database, with seeders/scheduled production writes disabled. Use authorized existing test accounts; do not create fake production accounts.
6. Complete real Student/Faculty/HOD/Admin login/logout/session/redirect smoke tests and Discipline RBAC/persistence checks. Verify the HOD account/data-source issue against the actual authorized production configuration rather than fabricating a replacement.
7. Only after the release checks are satisfied, prepare/review the commit and deploy to the already-linked existing project. Verify production health, authorized four-role authentication, Discipline access rules, and unchanged legitimate data after deployment. Do not roll back to the old `5e5b180` startup failure.

**Deployment decision now: hold.** Root cause and live syntax repair are verified; local security checks pass. Missing approved production signing-key configuration, positive per-role production smoke tests, and existing semantic type-check failures remain. No new production security deployment is claimed.
