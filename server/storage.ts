import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// COMMON 10 MB FILE SIZE LIMIT
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10,485,760 bytes
export const MSG_FILE_TOO_LARGE = 'File size exceeds 10 MB. Please upload a smaller file.';
export const UI_MAX_FILE_SIZE_LABEL = 'Maximum file size: 10 MB';

// STRICT DANGEROUS FILE TYPE BLOCKLIST
export const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml', '.pl', '.py',
  '.cgi', '.jar', '.vbs', '.js', '.ts', '.jsx', '.tsx', '.msi', '.ps1',
  '.scr', '.bin', '.app', '.com', '.gadget', '.hta', '.cpl', '.msc', '.wsf'
]);

// MODULE-SPECIFIC ALLOWED EXTENSIONS & MIME TYPES
export const BULK_ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv', '.png']);
export const BULK_ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'application/csv',
  'image/png'
]);

export const PROOF_ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
export const PROOF_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/pjpeg'
]);

export const PROJECT_ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'
]);
export const PROJECT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/pjpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

// SUPABASE STORAGE CONFIGURATION
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgemswdtghwwiqszfyzs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'department-proofs';

let supabaseClient: SupabaseClient | null = null;
if (SUPABASE_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    console.log(`[Storage] Initialized Supabase Storage client for project URL: ${SUPABASE_URL}, bucket: ${STORAGE_BUCKET}`);
  } catch (err: any) {
    console.warn('[Storage] Failed to initialize Supabase client:', err.message);
  }
} else {
  console.log('[Storage] SUPABASE_SERVICE_ROLE_KEY not detected in environment. Operating in hybrid persistent mode.');
}

// LOCAL FALLBACK DIRECTORY (for local offline dev or before Supabase key is configured)
const FALLBACK_DIR = process.env.VERCEL ? '/tmp/uploads' : path.resolve(process.cwd(), 'server', 'uploads');
try {
  if (!fs.existsSync(FALLBACK_DIR)) {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
  }
} catch {
  // Ignore in read-only environment
}

export function isSupabaseStorageReady(): boolean {
  return Boolean(supabaseClient && SUPABASE_KEY);
}

/**
 * Validate a file against dangerous extensions, 10MB limit, and module-specific allowed formats
 */
export function validateUploadedFile(
  file: { originalname: string; mimetype?: string; size: number },
  moduleType: 'bulk' | 'proof' | 'project'
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file was provided.' };
  }

  // 1. Strict 10 MB Size Limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: MSG_FILE_TOO_LARGE };
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  // 2. Reject Dangerous Executable / Script Extensions
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, error: 'Executable or script files are strictly prohibited.' };
  }

  // 3. Module-Specific Format Enforcement
  if (moduleType === 'bulk') {
    if (!BULK_ALLOWED_EXTENSIONS.has(ext) && mime !== 'image/png') {
      return { valid: false, error: 'Invalid file format. Only Excel (.xlsx, .xls), CSV (.csv), or PNG (.png) files are allowed for bulk import.' };
    }
  } else if (moduleType === 'project') {
    if (!PROJECT_ALLOWED_EXTENSIONS.has(ext)) {
      return { valid: false, error: 'Invalid file format. Projects accept Documents (.pdf, .doc, .docx, .ppt, .pptx) and Images (.jpg, .jpeg, .png).' };
    }
  } else {
    // proof / certificate / nptel / leetcode / participation
    if (!PROOF_ALLOWED_EXTENSIONS.has(ext)) {
      return { valid: false, error: 'Invalid file format. Only PDF (.pdf) and Images (.jpg, .jpeg, .png) are allowed.' };
    }
  }

  return { valid: true };
}

/**
 * Upload binary file buffer to Supabase Storage (with fallback if keys not yet provided)
 */
export async function uploadFileToStorage(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ storagePath: string; publicUrl?: string }> {
  const cleanPath = storagePath.replace(/^\/+/, '');

  if (supabaseClient && SUPABASE_KEY) {
    const { error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(cleanPath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.warn(`[Storage] Supabase Storage upload error for ${cleanPath}:`, error.message);
      // Fall through to local fallback if Supabase Storage reports an error
    } else {
      const { data: pubData } = supabaseClient.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(cleanPath);

      return {
        storagePath: cleanPath,
        publicUrl: pubData?.publicUrl
      };
    }
  }

  // Fallback storage
  try {
    const localPath = path.join(FALLBACK_DIR, path.basename(cleanPath));
    fs.writeFileSync(localPath, buffer);
  } catch (err: any) {
    console.warn('[Storage] Local fallback write warning:', err.message);
  }

  return { storagePath: cleanPath };
}

/**
 * Download / fetch binary file from Supabase Storage or local fallback
 */
export async function downloadFileFromStorage(
  storagePath: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const cleanPath = storagePath.replace(/^\/+/, '');

  if (supabaseClient && SUPABASE_KEY) {
    try {
      const { data, error } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .download(cleanPath);

      if (!error && data) {
        const arrayBuf = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const contentType = data.type || getMimeFromPath(cleanPath);
        return { buffer, contentType };
      }
    } catch (err: any) {
      console.warn(`[Storage] Supabase Storage download error for ${cleanPath}:`, err.message);
    }
  }

  // Check fallback directory
  const localFileName = path.basename(cleanPath);
  const localPath = path.join(FALLBACK_DIR, localFileName);
  if (fs.existsSync(localPath)) {
    const buffer = fs.readFileSync(localPath);
    return { buffer, contentType: getMimeFromPath(cleanPath) };
  }

  return null;
}

/**
 * Delete file from Supabase Storage and local fallback
 */
export async function deleteFileFromStorage(storagePath: string): Promise<boolean> {
  const cleanPath = storagePath.replace(/^\/+/, '');

  if (supabaseClient && SUPABASE_KEY) {
    try {
      const { error } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .remove([cleanPath]);
      if (error) {
        console.warn(`[Storage] Supabase Storage remove warning for ${cleanPath}:`, error.message);
      }
    } catch (err: any) {
      console.warn(`[Storage] Supabase Storage remove exception for ${cleanPath}:`, err.message);
    }
  }

  try {
    const localPath = path.join(FALLBACK_DIR, path.basename(cleanPath));
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch {
    // Ignore
  }

  return true;
}

export function getMimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv'
  };
  return map[ext] || 'application/octet-stream';
}

export function detectMimeFromBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;
  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  // PNG: \x89PNG (0x89 0x50 0x4E 0x47)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: \xFF\xD8\xFF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  return null;
}

export async function fetchRemoteFormBuilderBuffer(storedFileName: string): Promise<{ buffer: Buffer; contentType?: string } | null> {
  if (!storedFileName || (!storedFileName.startsWith('/api/files') && !storedFileName.startsWith('http'))) {
    return null;
  }
  // If storedFileName is a self-referential /api/files/:id path, resolve via db directly
  if (storedFileName.startsWith('/api/files/')) {
    const rawId = storedFileName.replace(/^\/api\/files\/(?:download\/)?/, '').split('/')[0].split('?')[0];
    if (rawId) {
      try {
        const { db } = await import('./db.js');
        const internalAtt = await db.getAttachmentById(rawId);
        if (internalAtt?.file_data) {
          const buf = Buffer.isBuffer(internalAtt.file_data) ? internalAtt.file_data : Buffer.from(internalAtt.file_data);
          return {
            buffer: buf,
            contentType: internalAtt.mime_type || detectMimeFromBuffer(buf) || undefined
          };
        }
      } catch {
        // Fall through to remote fetch
      }
    }
  }

  const formBuilderBase = (process.env.FORM_BUILDER_API_URL || 'http://127.0.0.1:5000').replace(/\/api$/, '');
  const url = storedFileName.startsWith('http') ? storedFileName : `${formBuilderBase}${storedFileName}`;
  const syncKey = process.env.HOD_INTEGRATION_KEY?.trim();

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${syncKey}`,
        'X-HOD-Integration-Key': syncKey || ''
      }
    });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const headerContentType = res.headers.get('content-type') || undefined;
      return {
        buffer,
        contentType: headerContentType || detectMimeFromBuffer(buffer) || undefined
      };
    }
  } catch (err: any) {
    console.error('[HOD Files Proxy] Remote proof fetch failed:', err.message);
  }
  return null;
}

