import Tesseract from 'tesseract.js';
import { geminiKeyManager } from './geminiKeyManager.js';

export function normalizePersonName(name: string): string {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function verifyStudentNameMatch(inputName: string, dbStudentName: string): boolean {
  if (!inputName || !inputName.trim()) return true;
  const normInput = normalizePersonName(inputName);
  const normDb = normalizePersonName(dbStudentName);
  if (!normInput || !normDb) return true;
  if (normInput === normDb) return true;

  const inputWords = normInput.split(' ').filter(Boolean).sort();
  const dbWords = normDb.split(' ').filter(Boolean).sort();
  if (inputWords.join(' ') === dbWords.join(' ')) return true;

  const longInput = inputWords.filter((w) => w.length > 1);
  const longDb = dbWords.filter((w) => w.length > 1);
  if (longInput.length > 0 && longDb.length > 0 && longInput.join(' ') === longDb.join(' ')) {
    return true;
  }

  return false;
}

export interface ExtractedOcrAttendanceRow {
  id: string;
  registerNo: string;
  studentName: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'OD' | 'ML';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  matchedInRoster?: boolean;
  nameMatch?: boolean;
  suggestedName?: string;
  warning?: string;
  originalText?: string;
}

export interface AttendanceOcrExtractionResult {
  success: boolean;
  extractedRows: ExtractedOcrAttendanceRow[];
  unparsed: Array<{ lineIndex: number; text: string; reason: string }>;
  rawText?: string;
  method: 'GEMINI_VISION' | 'TESSERACT_OCR' | 'FALLBACK';
  warnings: string[];
}

/**
 * Intelligent text parser that extracts attendance records from unstructured OCR text.
 */
export function parseAttendanceOcrText(
  rawText: string,
  defaultDate?: string,
  roster: Array<{ id?: string; name: string; register_no?: string; registerNo?: string; year?: string; section?: string }> = []
): { rows: ExtractedOcrAttendanceRow[]; unparsed: Array<{ lineIndex: number; text: string; reason: string }> } {
  const fallbackDate = defaultDate || new Date().toISOString().split('T')[0];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ExtractedOcrAttendanceRow[] = [];
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

    // Skip general sheet headers
    if (/^(s\.?no|sl\.?no|register\s*no|roll\s*no|student\s*name|attendance|date\s*status)/i.test(line)) {
      continue;
    }
    if (/^(department\s*of|avsec|attendance\s*sheet|class\s*attendance|portal)/i.test(line)) {
      continue;
    }

    // 1. Extract Register Number
    let regNo = '';
    const regMatch = line.match(/\b(\d{12}|\d{2}[A-Za-z]{2,5}\d{2,6}|[A-Za-z]{2,4}\d{4,8})\b/);
    if (regMatch) {
      regNo = regMatch[1].toUpperCase();
    } else {
      // Check if line contains known roster register number
      for (const knownReg of rosterMap.keys()) {
        if (line.toUpperCase().includes(knownReg)) {
          regNo = knownReg;
          break;
        }
      }
    }

    if (!regNo) {
      unparsed.push({ lineIndex: i + 1, text: line, reason: 'No recognizable Register Number found in line' });
      continue;
    }

    // 2. Extract Date
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

    // 3. Extract Status (prioritize multi-letter keywords over single letter P/A)
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
      if (verifyStudentNameMatch(remaining, studentInRoster.name)) {
        studentName = studentInRoster.name;
      } else {
        studentName = remaining.toUpperCase();
      }
    } else if (remaining) {
      studentName = remaining.toUpperCase();
    } else if (studentInRoster) {
      studentName = studentInRoster.name;
    }

    const matchedInRoster = Boolean(studentInRoster);
    let nameMatch = true;
    let warning: string | undefined;

    if (studentInRoster && studentName) {
      nameMatch = verifyStudentNameMatch(studentName, studentInRoster.name);
      if (!nameMatch) {
        warning = `Name "${studentName}" differs from registered name "${studentInRoster.name}".`;
      }
    } else if (!studentInRoster) {
      warning = `Register Number "${regNo}" not found in current roster.`;
    }

    rows.push({
      id: `ocr-${i + 1}-${Math.random().toString(36).substring(2, 7)}`,
      registerNo: regNo,
      studentName: studentName || (studentInRoster ? studentInRoster.name : ''),
      date,
      status,
      confidence: matchedInRoster && nameMatch ? 'HIGH' : matchedInRoster ? 'MEDIUM' : 'LOW',
      matchedInRoster,
      nameMatch,
      suggestedName: studentInRoster?.name,
      warning,
      originalText: line
    });
  }

  return { rows, unparsed };
}

/**
 * Extracts attendance rows from an image buffer using Gemini Vision (if configured)
 * or Tesseract OCR with regex tabular parsing as a high-reliability fallback.
 */
export async function extractAttendanceFromImage(
  imageBuffer: Buffer,
  mimeType: string = 'image/png',
  defaultDate?: string,
  roster: Array<{ id?: string; name: string; register_no?: string; registerNo?: string; year?: string; section?: string }> = []
): Promise<AttendanceOcrExtractionResult> {
  const fallbackDate = defaultDate || new Date().toISOString().split('T')[0];
  const warnings: string[] = [];

  // Attempt 1: Gemini Vision if keys are available
  const isGeminiAvailable = typeof geminiKeyManager.isConfigured === 'function'
    ? geminiKeyManager.isConfigured()
    : Boolean(geminiKeyManager.getApiStatus?.()?.isConfigured);

  if (isGeminiAvailable) {
    try {
      const prompt = `You are a specialized OCR system for college attendance sheets.
Extract all student attendance rows from the provided image.
Return ONLY a valid JSON array of objects. Do not include markdown codeblocks (e.g. \`\`\`json).
Each object MUST have these exact properties:
- "registerNo": string (e.g. "620125243146" or "23AD001")
- "studentName": string (student full name)
- "date": string (format: "YYYY-MM-DD", fallback to "${fallbackDate}" if not present on sheet)
- "status": string ("PRESENT", "ABSENT", "OD", or "ML")

Example output:
[
  {"registerNo": "620125243146", "studentName": "SARAN S", "date": "${fallbackDate}", "status": "PRESENT"},
  {"registerNo": "620125243154", "studentName": "SHRVAN A", "date": "${fallbackDate}", "status": "OD"}
]`;

      const genResult = await geminiKeyManager.generateContent(prompt, {
        preferredModels: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'],
        temperature: 0.1,
        timeoutMs: 15000,
        image: {
          mimeType: mimeType || 'image/png',
          dataBase64: imageBuffer.toString('base64')
        }
      });

      if (genResult.success && genResult.text) {
        let cleanedJson = genResult.text.trim();
        if (cleanedJson.startsWith('```json')) cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        else if (cleanedJson.startsWith('```')) cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');

        const parsed = JSON.parse(cleanedJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const rosterMap = new Map<string, any>();
          roster.forEach((s) => {
            const r = (s.register_no || s.registerNo || '').trim().toUpperCase();
            if (r) rosterMap.set(r, s);
          });

          const extractedRows: ExtractedOcrAttendanceRow[] = parsed.map((item: any, idx: number) => {
            const regNo = String(item.registerNo || item.register_no || '').trim().toUpperCase();
            const rawStatus = String(item.status || 'PRESENT').trim().toUpperCase();
            let normStatus: 'PRESENT' | 'ABSENT' | 'OD' | 'ML' = 'PRESENT';
            if (['P', 'PRESENT'].includes(rawStatus)) normStatus = 'PRESENT';
            else if (['A', 'ABSENT'].includes(rawStatus)) normStatus = 'ABSENT';
            else if (['OD', 'ON', 'ONDUTY', 'ON DUTY'].includes(rawStatus)) normStatus = 'OD';
            else if (['ML', 'LEAVE', 'MEDICAL LEAVE'].includes(rawStatus)) normStatus = 'ML';

            const studentInRoster = rosterMap.get(regNo);
            const studentName = String(item.studentName || item.name || studentInRoster?.name || '').trim().toUpperCase();
            const matchedInRoster = Boolean(studentInRoster);
            let nameMatch = true;
            let warning: string | undefined;

            if (studentInRoster && studentName) {
              nameMatch = verifyStudentNameMatch(studentName, studentInRoster.name);
              if (!nameMatch) {
                warning = `Name "${studentName}" differs from registered name "${studentInRoster.name}".`;
              }
            } else if (!studentInRoster) {
              warning = `Register Number "${regNo}" not found in assigned roster.`;
            }

            return {
              id: `gemini-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
              registerNo,
              studentName,
              date: item.date || fallbackDate,
              status: normStatus,
              confidence: matchedInRoster && nameMatch ? 'HIGH' : matchedInRoster ? 'MEDIUM' : 'LOW',
              matchedInRoster,
              nameMatch,
              suggestedName: studentInRoster?.name,
              warning
            };
          });

          return {
            success: true,
            extractedRows,
            unparsed: [],
            rawText: genResult.text,
            method: 'GEMINI_VISION',
            warnings
          };
        }
      }
    } catch (geminiErr: any) {
      warnings.push(`Gemini Vision OCR error: ${geminiErr.message || 'Processing error'}. Falling back to Tesseract OCR.`);
    }
  }

  // Attempt 2: Tesseract OCR fallback
  if (process.env.VERCEL === '1') {
    return {
      success: false,
      extractedRows: [],
      unparsed: [],
      method: 'FALLBACK',
      warnings: [...warnings, 'Serverless runtime: delegating OCR to client-side browser engine.']
    };
  }

  try {
    const ocrResult = await Tesseract.recognize(imageBuffer, 'eng');
    const rawText = ocrResult.data.text || '';
    const parsed = parseAttendanceOcrText(rawText, fallbackDate, roster);

    return {
      success: true,
      extractedRows: parsed.rows,
      unparsed: parsed.unparsed,
      rawText,
      method: 'TESSERACT_OCR',
      warnings
    };
  } catch (tessErr: any) {
    return {
      success: false,
      extractedRows: [],
      unparsed: [],
      method: 'FALLBACK',
      warnings: [...warnings, `Tesseract OCR error: ${tessErr.message || 'Failed to process image'}`]
    };
  }
}
