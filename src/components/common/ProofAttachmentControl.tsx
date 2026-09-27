import React, { useState, useEffect, useRef } from 'react';
import { API } from '../../services/api';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  Upload,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileCheck,
  Loader2
} from 'lucide-react';

interface ProofAttachmentControlProps {
  studentId: string;
  recordType: string;
  recordId: string;
  userRole: 'STUDENT' | 'FACULTY' | 'HOD' | 'ADMIN';
  readOnly?: boolean;
  onAttachmentChanged?: () => void;
}

export const ProofAttachmentControl: React.FC<ProofAttachmentControlProps> = ({
  studentId,
  recordType,
  recordId,
  userRole,
  readOnly = false,
  onAttachmentChanged
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isStudentReadOnly = userRole === 'STUDENT' || readOnly;

  const fetchAttachment = React.useCallback(async () => {
    if (!studentId || !recordId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await API.getRecordAttachment(studentId, recordType, recordId);
      setAttachment(res.attachment || null);
    } catch {
      setAttachment(null);
    } finally {
      setLoading(false);
    }
  }, [recordId, recordType, studentId]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchAttachment();
  }, [fetchAttachment]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');

    // Check size limit (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File size exceeds 10 MB limit. Please select a smaller file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Check extension
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const validExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!validExts.includes(ext)) {
      setErrorMsg('Invalid file type. Only PDF, JPG, JPEG, and PNG files under 10 MB are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const res = await API.uploadProofFile(studentId, recordType, recordId, file);
      setAttachment(res.attachment);
      setSuccessMsg(res.message || 'Proof uploaded successfully!');
      if (onAttachmentChanged) onAttachmentChanged();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload proof file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!attachment) return;
    setIsDeleting(true);
    setErrorMsg('');
    try {
      await API.deleteProofFile(attachment.id);
      setAttachment(null);
      setShowDeleteModal(false);
      setSuccessMsg('Proof file deleted successfully.');
      if (onAttachmentChanged) onAttachmentChanged();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete proof file.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2 text-xs">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
      />

      {errorMsg && (
        <div className="bg-red-950/80 border border-red-800/80 text-red-300 p-2 rounded-lg flex items-center space-x-2 font-mono text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 p-2 rounded-lg flex items-center space-x-2 font-mono text-[11px]">
          <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center space-x-2 text-slate-400 py-1 text-[11px] font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>Checking proof attachment...</span>
        </div>
      ) : attachment ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white truncate max-w-xs">{attachment.originalFileName}</div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
                <span>{formatFileSize(attachment.fileSize)}</span>
                <span>•</span>
                <span>{attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-auto">
            <a
              href={`/api/files/${attachment.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800 hover:bg-slate-700 text-cyan-400 px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center space-x-1"
              title="View Inline"
            >
              <Eye className="w-3 h-3" />
              <span>View</span>
            </a>

            <a
              href={`/api/files/${attachment.id}/download`}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center space-x-1"
              title="Download Attachment"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </a>

            {!isStudentReadOnly && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center space-x-1 disabled:opacity-50"
                  title="Replace Attachment"
                >
                  <RefreshCw className={`w-3 h-3 ${isUploading ? 'animate-spin' : ''}`} />
                  <span>Replace</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-red-950/60 hover:bg-red-900 text-red-400 p-1 rounded-md"
                  title="Delete Attachment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between py-1">
          <div className="text-[11px] text-slate-400 font-mono">
            <span>No proof attached</span>
            {!isStudentReadOnly && <span className="text-slate-500 block text-[10px]">Maximum file size: 10 MB (PDF, JPG, PNG)</span>}
          </div>

          {!isStudentReadOnly && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold px-3 py-1 rounded-lg text-[11px] flex items-center space-x-1.5 transition-all disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Proof</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        recordName={attachment?.originalFileName || 'Proof Attachment'}
        recordType="Proof Document"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        isDeleting={isDeleting}
      />
    </div>
  );
};
