# Reference inventory — 21 October 2026

Source: https://avsec-discipline.vercel.app/ and its publicly served `app.js` and `styles.css`.
Public artifacts were downloaded into ignored `scratch/reference-discipline/` for inspection.
This is a **static source inspection**, not authenticated browser verification. No browser-control tool is available in this session.
No source database, storage objects, Auth accounts, Firestore rules, or private repository were accessed.

## Routes, roles, and navigation

The inspected application is a single HTML page at `/`. Views and tabs switch in JavaScript, without separate URL routes.

| View | Exact labels / behavior in served code | Verification limit |
| --- | --- | --- |
| Login | Discipline Portal; Discipline Register Access; Registered Email; Password; Select Role; Faculty; Admin; Sign In | Form markup and handler inspected; successful login not tested |
| Faculty | Incident; Reports | Hidden authenticated sections and tab handlers inspected |
| Incident form | Register Discipline Case; New Entry; Submit Incident | Persistence requires authenticated Firestore access |
| Faculty reports | Faculty Reports; My Records; Single Day; Date Range; Overall; Get Report | Query filters `loggedByEmail` equal to authenticated email |
| Admin | Overview; Students; Faculty | Role loaded from `users/{Firebase Auth UID}` |
| Admin overview | Admin Overview & Analytics; Institution Wide; Discipline Records Dashboard | Data and calculations unverified against live records |
| Student roster | Manage Student Records; Bulk Import; Download CSV Template; Import Students | Admin-only view; Firestore rules unavailable |
| Faculty roster | Manage Faculty Records; Bulk Import; Download CSV Template; Import Faculty | Faculty roster import does not itself create Auth accounts |
| Session | Sign Out; Firebase `onAuthStateChanged` restores views after reload | No live session verification |

The client explicitly initializes Firebase Auth and Firestore for project `avs-discipline`. This verifies the served client integration, not backend rules, ownership, connectivity, or accessible record counts. There are no custom Express endpoints in the inspected reference assets; the client calls Firebase SDK methods directly.

## Form and record fields

| Form label / entity | Stored field / rule |
| --- | --- |
| Incident Date | `dateString`; required HTML date |
| Incident Time | `timeString`; required HTML time |
| Department | `department`; required selection |
| Reporting Faculty (any dept) | `facultyName`; required roster selection |
| Student Year | `year`; I, II, III, IV; disabled until department selected |
| Search Student — Name / Reg No | Required selection from the selected department/year roster |
| Student Snapshot: Reg No; Year / Sec; Prior Incidents | `regNo`, `year`, `section`; prior count queries all `discipline_incidents` with matching `studentId` |
| Block / Location (by dept) | `blockName`; required selection |
| Discipline Issue (by dept) | `violationType`; required selection |
| Other Comments (optional) | `comments`; trimmed textarea |
| Selected identity and snapshots | `studentId`, `studentName`, `regNo`, `section` |
| Logged-in identity | `loggedByEmail` from Firebase Auth |
| Created timestamp | `timestamp` from Firestore `serverTimestamp()` |
| Student master | Document ID, `name`, `regNo`, `department`, `year`, `section` |
| Faculty master | Document ID, `name`, `department`, `email` |
| User permission document | Document ID = Auth UID; `role` read by client; full document schema unknown |

Departments: AI&DS, BME, CIVIL, CSE, CSE(AI&ML), ECE, EEE, IT, MECH, MBA, MCA.

Common issue options, in served order:

1. Late Arrival
2. Dress Code Violation
3. Not Wearing ID Card
4. Wearing Ornaments
5. Mobile Phone Usage
6. Misbehavior
7. Improper Hairstyle
8. Not Wearing Shoes
9. Roaming in Other Departments
10. Roaming in Common Areas During Class Hours
11. Parking Misuse
12. Bike Stunt
13. Playing During Class Hours
14. Roaming During Class Hours
15. Unauthorized Exit
16. Inappropriate Interaction with Opposite Gender
17. Ragging
18. Drug Use
19. Triple Riding
20. Riding Without a Helmet

Location options: Gate; In Front of Boys Hostel; Student Two-Wheeler Parking; Near Coffee Day; Ground; Near Stage; In Front of SkillEdge Block; Near Bus Shed; APJ Abdul Kalam Block (Main Block); H. J. Bhabha Block (EEE Block); Srinivasa Ramanujan Block (First Year Block); J. C. Bose Block (Civil & Mech Block); Ratan Tata Block (MBA Block); Mahatma Gandhi Block (Library); M. S. Dhoni Block (Canteen & Sports Complex); SkillEdge Block; Kailash Boys Hostel; Sivakami Ammal Girls Hostel; Others.

Department-specific location/issue additions are commented out in the inspected JavaScript. Do not enable them as verified features.

## Reports, statistics, import behavior

Faculty table columns: Date, Time, Student, Reg No, Dept, Year, Section, Violation, Block. Admin adds Faculty after Time.

Faculty reports support exact single date, inclusive start/end dates, and all time, scoped to `loggedByEmail`. Results sort by creation timestamp descending.

Admin filters: Department; Faculty; Issue / Violation Type; From; To; Individual Student Search; Apply Filters. Student search matches name or register number. Department filtering is sent to Firestore; remaining filtering occurs in the client. Results sort by timestamp descending.

Admin statistics:

- Total Incidents: every returned incident.
- Today's Incidents: `dateString` equals today's UTC date string.
- Last 7 Days: inclusive UTC date string range from today minus six days through today.
- Reporting Faculty: distinct `facultyName`, falling back to `loggedByEmail` and then `Unknown`.
- Faculty-wise Booking Count: group by faculty display name plus the incident's department.

PDF uses jsPDF/html rendering; Excel uses SheetJS table conversion; Image uses html2canvas PNG export. File generation was inspected in code but not exercised in an authenticated browser.

Student import accepts CSV/XLS/XLSX with `name, regNo, department, year, section`. Name/register/valid department/year are checked; section is trimmed. Firestore document key is register number and merge upsert is used, in batches of 400. Faculty columns are `name, department, email`; email is optional; key derives from an email slug or name/department slug, with merge upserts in batches of 400.

The source contains sample students and faculty fallback arrays. They are **demo data**, not a verified export, and must not be migrated or used to make missing records appear populated.

## Visual and responsive specification observed in CSS

- Navy `#0B2A5C`, blue `#2454DB`, paper `#F2F5FB`, white cards, borders `#E1E7F3`.
- Manrope display, Inter body, JetBrains Mono data typography, loaded from Google Fonts.
- Card radii 18/12/8 px, blue letterhead, bordered cards, student snapshot ticket, status feedback, loading button labels, slide/pop animations.
- Container 860 px, expanding to 1080 px at 1100 px viewport width.
- Mobile bottom navigation changes to inline desktop tabs at 600 px; two-column form rows and four-column metrics start there.
- Additional adjustments at 380, 420, 480, 900, and 1100 px; role badge hides below 420 px; reduced-motion query minimizes transitions.
- Original logo is `unnamed.jpg`; reuse rights/exact asset match have not been verified. Local login uses an existing main-project logo.

## Not established from public assets

No incident editing, deletion, status transitions, separate history collection, or discipline attachment upload was found in the inspected client. That does not prove they are absent from private tooling. Do not invent them or claim that their migration is complete.

Unknown: actual collection sizes, document variants, historical records, foreign references, deleted records, auth claim mappings, Firestore indexes/rules, Cloud Functions, Storage files/metadata/ACLs, hidden routes, private administrative workflows, and actual responsive browser screenshots.
