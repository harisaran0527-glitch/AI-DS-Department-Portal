import Tesseract from 'tesseract.js';

export interface ExtractedAttendanceRow {
  id: string;
  registerNo: string;
  studentName: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'OD' | 'ML';
  confidence?: number;
  originalText?: string;
  isEdited?: boolean;
}

export interface OcrParseResult {
  rows: ExtractedAttendanceRow[];
  unparsed: Array<{ lineIndex: number; text: string; reason: string }>;
  rawText: string;
}

/**
 * Intelligent parser that extracts Register Number, Student Name, Attendance Date,
 * and Attendance Status from raw OCR recognized text.
 */
export function parseAttendanceOcrText(
  rawText: string,
  defaultDate?: string,
  roster: Array<{ id?: string; name: string; register_no?: string; registerNo?: string }> = []
): OcrParseResult {
  const fallbackDate = defaultDate || new Date().toISOString().split('T')[0];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ExtractedAttendanceRow[] = [];
  const unparsed: Array<{ lineIndex: number; text: string; reason: string }> = [];

  const rosterMap = new Map<string, { id?: string; name: string; registerNo: string }>();
  roster.forEach((s) => {
    const reg = (s.register_no || s.registerNo || '').trim().toUpperCase();
    if (reg) {
      rosterMap.set(reg, { id: s.id, name: s.name, registerNo: reg });
    }
  });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip generic header lines
    if (/^(s\.?no|sl\.?no|register\s*no|roll\s*no|student\s*name|attendance|date\s*status)/i.test(line)) {
      continue;
    }
    if (/^(department\s*of|avsec|attendance\s*sheet|class\s*attendance|portal)/i.test(line)) {
      continue;
    }

    // 1. Extract Register Number
    let regNo = '';
    // Look for 12-digit numeric, or format like 23AD001, CS2024, etc.
    const regMatch = line.match(/\b(\d{12}|\d{2}[A-Za-z]{2,5}\d{2,6}|[A-Za-z]{2,4}\d{4,8})\b/);
    if (regMatch) {
      regNo = regMatch[1].toUpperCase();
    } else {
      // Check against roster registered numbers directly
      for (const knownReg of rosterMap.keys()) {
        if (line.toUpperCase().includes(knownReg)) {
          regNo = knownReg;
          break;
        }
      }
    }

    if (!regNo) {
      unparsed.push({ lineIndex: i + 1, text: line, reason: 'No recognizable Register Number found in this line' });
      continue;
    }

    // 2. Extract Attendance Date
    let date = fallbackDate;
    const dateMatch = line.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/);
    if (dateMatch) {
      const rawDate = dateMatch[1];
      if (/^\d{4}/.test(rawDate)) {
        const parts = rawDate.split(/[-/]/);
        date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        const parts = rawDate.split(/[-/]/);
        date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    // 3. Extract Attendance Status (prioritize multi-letter keywords over single letter P/A)
    let status: 'PRESENT' | 'ABSENT' | 'OD' | 'ML' = 'PRESENT';
    let statusToken = '';
    let statusTokenIndex = -1;

    const multiMatch = line.match(/\b(PRESENT|ABSENT|ON[\s_\-]?DUTY|OD|ON|MEDICAL[\s_\-]?LEAVE|ML|LEAVE)\b/i);
    if (multiMatch) {
      statusToken = multiMatch[0];
      statusTokenIndex = multiMatch.index ?? -1;
      const clean = multiMatch[1].toUpperCase().replace(/[\s_\-]/g, '');
      if (clean === 'PRESENT') status = 'PRESENT';
      else if (clean === 'ABSENT') status = 'ABSENT';
      else if (clean === 'OD' || clean === 'ON' || clean === 'ONDUTY' || clean === 'DUTY') status = 'OD';
      else if (clean === 'ML' || clean === 'LEAVE' || clean === 'MEDICALLEAVE') status = 'ML';
    } else {
      const endSingle = line.match(/(?:\s|^)([PA])\s*$/i);
      if (endSingle) {
        statusToken = endSingle[1];
        statusTokenIndex = line.lastIndexOf(statusToken);
        status = endSingle[1].toUpperCase() === 'P' ? 'PRESENT' : 'ABSENT';
      } else {
        const anySingle = line.match(/(?:\s)([PA])(?:\s)/i);
        if (anySingle) {
          statusToken = anySingle[1];
          statusTokenIndex = anySingle.index ? anySingle.index + 1 : -1;
          status = anySingle[1].toUpperCase() === 'P' ? 'PRESENT' : 'ABSENT';
        }
      }
    }

    // 4. Extract Student Name safely by masking regNo, date, and status by exact positions
    const charArr = line.split('');
    const maskRange = (start: number, len: number) => {
      if (start >= 0 && len > 0) {
        for (let idx = start; idx < start + len && idx < charArr.length; idx++) {
          charArr[idx] = ' ';
        }
      }
    };

    if (regMatch && regMatch.index !== undefined) {
      maskRange(regMatch.index, regMatch[0].length);
    }
    if (dateMatch && dateMatch.index !== undefined) {
      maskRange(dateMatch.index, dateMatch[0].length);
    }
    if (statusTokenIndex >= 0 && statusToken) {
      maskRange(statusTokenIndex, statusToken.length);
    }

    const remaining = charArr.join('')
      .replace(/^\s*\d+[.\s)_-]+/, ' ')
      .replace(/[^A-Za-z\s.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const studentInRoster = rosterMap.get(regNo);
    let studentName = '';

    if (studentInRoster && remaining) {
      const normRem = remaining.toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const normDb = studentInRoster.name.toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      if (normRem === normDb || normRem.split(' ').sort().join(' ') === normDb.split(' ').sort().join(' ')) {
        studentName = studentInRoster.name;
      } else {
        studentName = remaining.toUpperCase();
      }
    } else if (remaining) {
      studentName = remaining.toUpperCase();
    } else if (studentInRoster) {
      studentName = studentInRoster.name;
    }

    rows.push({
      id: `ocr-${i + 1}-${Math.random().toString(36).substring(2, 7)}`,
      registerNo: regNo,
      studentName: studentName || (studentInRoster ? studentInRoster.name : ''),
      date,
      status,
      originalText: line
    });
  }

  return { rows, unparsed, rawText };
}

/**
 * Recognize text from a PNG image file using Tesseract.js with progress reporting.
 */
export async function recognizeAttendanceImageWithTesseract(
  file: File | Blob,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const result = await Tesseract.recognize(file, 'eng', {
    logger: (m) => {
      if (onProgress && m.status) {
        onProgress(Math.round((m.progress || 0) * 100), m.status);
      }
    }
  });

  return result.data.text || '';
}
