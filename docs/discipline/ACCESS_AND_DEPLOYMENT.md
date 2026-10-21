# Access requirements and deployment handoff

Updated status: the existing Vercel project is now linked through the authenticated CLI. See [RECOVERY_REPORT.md](RECOVERY_REPORT.md) for verified deployed commits, runtime-log diagnosis, recovered security tests, and the missing production JWT configuration blocker. Earlier access observations below are historical.

## What is already available

- Local working tree and Git history; `origin` points to `https://github.com/harisaran0527-glitch/AI-DS-Department-Portal.git`.
- Existing `vercel.json`, Vite frontend, `api/index.ts` Express entry, and local environment configuration.
- Read-only access to the PostgreSQL connection in local `.env`, tested successfully. This does not establish that Vercel has the same environment.
- Public reference HTML, JavaScript, and CSS. The served code explicitly calls Firebase Auth/Firestore for project `avs-discipline`.

No Vercel project link, Vercel CLI auth file, Vercel token environment variable, or connected Vercel integration was confirmed during inspection. Git remote presence alone does not establish push permission. Vercel integration is available but was not connected at the last confirmed check.

## Exact missing source access

1. **Reference repository:** URL/access to the repository that builds `avsec-discipline.vercel.app`. It has not been identified; the main HOD repository is not evidence of ownership of the reference deployment.
2. **Reference database:** owner-authorized Firestore export for Firebase project `avs-discipline`, retaining all document paths/IDs and typed values. Include schema variants, rules, indexes, and any functions that affect writes. Owner can instead grant an approved read/export role through their Firebase/Google Cloud account workflow.
3. **Reference storage:** owner-generated object inventory and authorized exports/download access, with metadata, checksums, and rules. A storage bucket name in public client code is not storage access.
4. **Reference accounts:** authorized existing Faculty and Admin test sessions, provisioned through an approved secure mechanism. Do not reset accounts or create demo production accounts. No passwords, keys, or service-account files in chat or tracked files.
5. **Scope and roles:** owner-approved mappings for reference faculty/admin users and non-AI&DS students. Source client permits cross-department reporting; main-project faculty boundaries must remain intact until permission changes are approved.

## Production HTTP 500 investigation

Observed 21 October 2026: `https://aidsportal.vercel.app/api/health` returned HTTP 500 with `FUNCTION_INVOCATION_FAILED`. A passing frontend build does not compile/check all backend code.

Local commit `5e5b180` contains a duplicated `return true;` and class-closing brace at `server/db.ts:2683`. TypeScript parsing that committed file produced 1207 cascading syntax diagnostics. The pending local two-line removal already present when this task began produces zero syntax diagnostics. It has been preserved. This is a concrete backend startup defect and a **candidate** explanation for production failure; the production commit and runtime logs have not been verified.

To grant the required deployment access:

1. Connect the Vercel account owning the `aidsportal` project in the available Vercel integration, selecting the correct team/project. Alternatively, authorize the Vercel CLI locally with `vercel login` from a trusted terminal. Keep account credentials/tokens out of chat.
2. Grant access to deployment details, build logs, and function/runtime logs for the failing deployment. Check deployed Git SHA and the first exception for `/api/health` and `/api/auth/login`.
3. Verify the production PostgreSQL environment and secret configuration in Vercel settings without printing values. Compare with the authorized main database.
4. Provide authorized test sessions/accounts for Student, Faculty, HOD, and Admin through a secure environment/account workflow. The configured local destination currently has **no HOD user**. Do not create one or modify credentials without owner authorization.
5. Validate the reviewed startup fix in an isolated/preview deployment and run authorized role/session/redirect tests before promoting any authentication-dependent Discipline changes.

## Two-interface deployment configuration

The new `/discipline/login` entry uses existing main-portal authentication, not copied Firebase passwords. Existing `/discipline`, `/discipline-issues`, and `/faculty/discipline` URLs are retained. The HOD dashboard gets a separate Discipline navigation tab, reusing the same existing module and API.

`deployment/discipline.env.example` provides a frontend-only build switch:

```text
VITE_DISCIPLINE_PORTAL=true
VITE_API_BASE_URL=https://aidsportal.vercel.app/api
```

With the switch, the frontend root points to Discipline login. Both interfaces call the existing shared backend; do not create a second disconnected database. This configuration **does not** establish completed reference functionality or authorize a new deployment.

Use an owner-selected existing independent destination if one is authorized. Otherwise obtain explicit approval for the exact new Vercel project name/team/domain before creating it. Do not deploy over the reference portal. No new repository or production project has been created.

Do not push a commit that auto-deploys authentication-dependent work before the production diagnosis and required role tests are complete. Review only intended files, exclude `.env`, exports, databases, credentials, and raw reference artifacts, and preserve legitimate pending work. Commit/push/deployment status must be reported from actual tool evidence, never inferred from a local build.
