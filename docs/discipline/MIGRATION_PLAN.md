# Non-destructive Discipline migration plan

Status: **not executed**. Source access and backups are missing. The destination was inspected in a read-only PostgreSQL transaction; no source records or demo arrays were inserted.

## Authority and backups

1. Identify the reference source repository and owner. Obtain authorized access to its Firebase project `avs-discipline`, or an owner-generated complete export. Public client configuration is not authorization to enumerate private records.
2. Have the owner export Firestore, including all document IDs, typed timestamps, collection/subcollection paths, `users`, `students`, `faculty`, `discipline_incidents`, and any additional collections found in the actual schema. Retain an immutable original export and checksums outside version control.
3. Inventory Firebase Storage objects, versions, object metadata, checksums, content types, and access rules. If there are no discipline files, obtain and document that verified result.
4. Back up destination PostgreSQL with a consistent snapshot, schema, constraints, and relevant authorized storage. Confirm a restore procedure before any writes. The read-only count audit is **not a backup**.
5. Record source/destination totals, duplicate identities, orphan relationships, and scope. The reference includes departments outside AI & DS; no existing main-portal user may gain access to those records automatically.

## Current schema differences

| Source Firestore field | Current PostgreSQL equivalent | Required handling |
| --- | --- | --- |
| `students.id`, `regNo` | `students.id`, `register_no` | Explicit source-to-destination identity map; never match by name |
| Roman `year`, `section`, `department` | Main student year/section/department | Normalize only for comparison; preserve original source values |
| Incident document ID | `discipline_records.id` | Dedicated provenance mapping and unique source key |
| `studentId` | `student_id` | Must resolve through verified mapping, not copied blindly |
| `dateString`, `timeString` | `date` (PostgreSQL date), `time` | Validate and preserve incident date/time separately from created time |
| `violationType` | `category` | Preserve exact text, including historical values not currently in dropdowns |
| `comments` | `remark` | Preserve original text |
| `facultyName` | No exact equivalent | Add reporting faculty snapshot; do not confuse it with assigned class coordinator |
| `loggedByEmail` | Current `recorded_by` is unstructured text | Preserve source logger and resolve approved staff mapping separately |
| `blockName` | No current column | Add location column or normalized extension with provenance |
| Firestore `timestamp` | `created_at` text | Preserve original typed timestamp, precision, and timezone |
| Source student name/reg/year snapshots | Current list joins current student profile | Preserve snapshots so historical academic details are not silently rewritten |
| Firebase `users/{uid}.role` | Main `users.role` and JWT sessions | Owner-approved mappings only; no copied passwords, reset passwords, or added privileges |
| Source storage references | Main file metadata/storage | Requires actual inventory and verified object copies |

The main database also has fine/action/rule/assigned-staff fields absent from the inspected reference. They must not be substituted for missing original fields. No schema changes have been applied in this work.

## Mapping and conflict rules

- Normalize register numbers by trimming and comparing case. Preserve leading zeros and original register strings.
- Treat source and destination IDs as separate namespaces. Accept a direct ID only when its register number and source provenance are also verified.
- Require unique matching register numbers and verify department, year, and section. Historical year differences require review; never overwrite main student demographics to make them match.
- Quarantine unmatched students and duplicate/conflicting identifiers for an owner-approved resolution. Do not create academic accounts or match by similar names.
- Preserve source user/faculty identity and display snapshots even when main-project identity mapping is unresolved. Do not grant access based on a matching display name.
- Use a unique `(source_system, source_record_id)` provenance key and transactionally write the record, mapping, original payload/checksum, and migration history. Repeat runs compare payload hashes; changed sources produce conflicts, not silent updates.
- Preserve all original source records, including unresolved records, in the protected migration archive. No deletions, truncation, or source writes.
- Stop on integrity or storage failures; record failed batches and allow safe resumption. Ambiguous committed writes must be checked by provenance before retry.

## Prepared offline tooling

`scripts/discipline-reconcile.mjs` performs **read-only offline identity reconciliation**. It is not a database migration/import script.

Inputs are owner-provided JSON snapshots:

```json
{
  "students": [{"id": "original-document-id", "regNo": "original-register-number", "year": "II", "section": "A", "department": "AI&DS"}],
  "discipline_incidents": [{"id": "original-incident-id", "studentId": "original-document-id", "regNo": "original-register-number", "year": "II", "section": "A", "department": "AI&DS"}]
}
```

The destination JSON has `students` and `discipline_records` arrays containing actual authorized rows. Use a typed conversion of the original Firestore export; retain the untouched native export separately. Do not create replacement records from these structural examples.

```powershell
node scripts/discipline-reconcile.mjs scratch/source-export.json scratch/destination-snapshot.json scratch/reconciliation.json
```

The command refuses to overwrite an existing report. It identifies missing relationships, duplicate registers, demographic conflicts, and possible existing records, preserving source fingerprints. It always reports `migrated: 0`. Reports contain identifiers and must remain in ignored, protected storage. A matching identity does not mean the incident has migrated or all fields/files are valid.

Read-only destination count/schema audit:

```powershell
node scripts/discipline-audit.mjs scratch/discipline-destination-audit.json
```

It reads the existing local environment, uses `BEGIN READ ONLY`, prints counts rather than personal records, and refuses to overwrite its output. It does not load application bootstrap or reset/create accounts.

## Required reconciliation before claiming completion

Compare source totals with imported + quarantined totals, unique provenance keys, and per-student totals. Check every FK, source hash, timestamp, snapshot, logger/faculty mapping, file checksum and metadata. Verify representative records in both interfaces after refresh, logout/re-login, and independent deployments. Check retry behavior, permissions, pagination, export completeness, mobile layouts, and source/destination backup restore evidence.

Until these checks pass, do not claim 100% migration, complete replication, reliable synchronization, or deployment readiness.
