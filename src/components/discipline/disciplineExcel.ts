import * as XLSX from 'xlsx';

interface DisciplineExportRecord {
  date?: string;
  time?: string;
  location?: string;
  registerNo?: string;
  studentName?: string;
  collegeEmail?: string;
  department?: string;
  year?: string;
  section?: string;
  issue?: string;
  category?: string;
  ruleViolated?: string;
  actionTaken?: string;
  fineAmount?: number;
  fineDetails?: string;
  remarks?: string;
  recordedBy?: string;
  status?: string;
}

const DISCIPLINE_EXPORT_HEADERS = [
  'S.No',
  'Date',
  'Time',
  'Register No',
  'Student Name',
  'College Mail ID',
  'Department',
  'Year',
  'Section',
  'Issue Category',
  'Location / Block',
  'Rule Violated',
  'Staff Action Taken',
  'Fine Amount (INR)',
  'Fine Details',
  'Additional Remarks',
  'Reported By Staff',
  'Status'
];

export function createDisciplineExportWorkbook(records: readonly DisciplineExportRecord[]): XLSX.WorkBook {
  const rows = records.map((record, index) => [
    index + 1,
    record.date || '',
    record.time || '',
    record.registerNo || '',
    record.studentName || '',
    record.collegeEmail || '',
    record.department || '',
    record.year || '',
    record.section || '',
    record.issue || record.category || '',
    record.location || '',
    record.ruleViolated || '',
    record.actionTaken || '',
    record.fineAmount || 0,
    record.fineDetails || '',
    record.remarks || '',
    record.recordedBy || '',
    record.status || 'OPEN'
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([DISCIPLINE_EXPORT_HEADERS, ...rows]),
    'Discipline Records'
  );
  return workbook;
}

const escapeXml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
}[character] || character));

export function createDisciplineReportSvg(records: readonly DisciplineExportRecord[]): string {
  const headers = [
    'Date', 'Time', 'Student Name', 'Register Number', 'Department', 'Year', 'Section',
    'Discipline Violation', 'Location / Block', 'Action Taken', 'Fine Amount (INR)',
    'Action / Fine Remarks', 'Recorded By', 'Incident Status'
  ];
  const values = records.map(record => [
    record.date, record.time, record.studentName, record.registerNo, record.department,
    record.year, record.section, record.issue || record.category, record.location,
    record.actionTaken, record.fineAmount ?? 0, record.remarks || record.fineDetails,
    record.recordedBy, record.status || 'OPEN'
  ]);
  const columnWidth = 190;
  const rowHeight = 36;
  const width = columnWidth * headers.length;
  const height = rowHeight * (values.length + 1) + 36;
  const headerCells = headers.map((header, index) => `<text x="${index * columnWidth + 10}" y="24">${escapeXml(header)}</text>`).join('');
  const rowCells = values.map((row, rowIndex) => {
    const y = 36 + (rowIndex + 1) * rowHeight;
    const background = rowIndex % 2 === 0 ? '#ffffff' : '#f1f5f9';
    const cells = row.map((value, columnIndex) =>
      `<text x="${columnIndex * columnWidth + 10}" y="${y + 23}">${escapeXml(value)}</text>`
    ).join('');
    return `<rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${background}"/>${cells}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>text{font:14px Arial,sans-serif;fill:#0f172a}rect{stroke:#cbd5e1;stroke-width:1}</style><rect x="0" y="0" width="${width}" height="${rowHeight}" fill="#0f172a"/><g style="font-weight:bold;fill:#fff">${headerCells}</g>${rowCells}</svg>`;
}
