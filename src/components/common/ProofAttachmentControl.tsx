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
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  ExternalLink
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

  // In-Portal Preview & Download State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewMimeType, setPreviewMimeType] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

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

  // Clean up Object URL on unmount or when viewer closes
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const isProjectRecord = recordType === 'projects';
  const allowedExtensions = isProjectRecord
    ? ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png']
    : ['.pdf', '.jpg', '.jpeg', '.png'];

  const dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.pl', '.py',
    '.cgi', '.jar', '.vbs', '.js', '.ts', '.jsx', '.tsx', '.msi', '.ps1'
  ];

  const getFileTypeCategory = (fileName: string, mime: string): 'image' | 'pdf' | 'office' | 'other' => {
    const ext = (fileName || '').substring(fileName.lastIndexOf('.')).toLowerCase();
    const cleanMime = (mime || '').toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) || cleanMime.startsWith('image/')) {
      return 'image';
    }
    if (ext === '.pdf' || cleanMime === 'application/pdf') {
      return 'pdf';
    }
    if (
      ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'].includes(ext) ||
      cleanMime.includes('wordprocessingml') ||
      cleanMime.includes('msword') ||
      cleanMime.includes('presentationml') ||
      cleanMime.includes('ms-powerpoint') ||
      cleanMime.includes('spreadsheetml') ||
      cleanMime.includes('ms-excel')
    ) {
      return 'office';
    }
    return 'other';
  };

  const handleViewAttachment = async () => {
    if (!attachment?.id) return;
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerError(null);
    setZoomLevel(1);
    setRotation(0);
    setPreviewFileName(attachment.originalFileName || 'attachment');
    setPreviewMimeType(attachment.mimeType || '');

    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }

    try {
      const { blob, contentType, fileName } = await API.getFileBlob(attachment.id);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      if (fileName) setPreviewFileName(fileName);
      if (contentType) setPreviewMimeType(contentType);
    } catch (err: any) {
      console.error('[ProofAttachmentControl] Error loading file blob:', err);
      setViewerError(err.message || 'File content missing from server storage or unable to load.');
    } finally {
      setViewerLoading(false);
    }
  };

  const handleCloseViewer = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setViewerOpen(false);
    setViewerError(null);
  };

  const handleDownloadAttachment = async () => {
    if (!attachment?.id) return;
    setIsDownloading(true);
    try {
      await API.downloadFileBlob(attachment.id, attachment.originalFileName);
    } catch (err: any) {
      console.error('[ProofAttachmentControl] Download error:', err);
      setErrorMsg(err.message || 'Failed to download attachment.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');

    // Strict 10 MB Size limit (10 * 1024 * 1024)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File size exceeds 10 MB. Please upload a smaller file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    // Dangerous extension check
    if (dangerousExtensions.includes(ext)) {
      setErrorMsg('Executable and script files are strictly prohibited.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Module-specific format check
    if (!allowedExtensions.includes(ext)) {
      setErrorMsg(
        isProjectRecord
          ? 'Invalid file type. Projects accept Documents (.pdf, .doc, .docx, .ppt, .pptx) and Images (.jpg, .jpeg, .png).'
          : 'Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.'
      );
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
    if (!bytes || isNaN(bytes)) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const fileCategory = attachment ? getFileTypeCategory(previewFileName || attachment.originalFileName, previewMimeType || attachment.mimeType) : 'other';

  return (
    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2 text-xs">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={
          isProjectRecord
            ? '.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png'
            : '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
        }
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
            <button
              type="button"
              onClick={handleViewAttachment}
              className="bg-slate-800 hover:bg-slate-700 text-cyan-400 px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
              title="View In-Portal Attachment"
            >
              <Eye className="w-3 h-3" />
              <span>View</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadAttachment}
              disabled={isDownloading}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center space-x-1 transition-all disabled:opacity-50 cursor-pointer"
              title="Download Attachment Authenticated"
            >
              {isDownloading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              <span>Download</span>
            </button>

            {!isStudentReadOnly && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                  title="Replace Attachment"
                >
                  <RefreshCw className={`w-3 h-3 ${isUploading ? 'animate-spin' : ''}`} />
                  <span>Replace</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-red-950/60 hover:bg-red-900 text-red-400 p-1 rounded-md cursor-pointer"
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
            {!isStudentReadOnly && (
              <span className="text-slate-500 block text-[10px]">
                Maximum file size: 10 MB ({isProjectRecord ? 'PDF, DOCX, PPTX, JPG, PNG' : 'PDF, JPG, PNG'})
              </span>
            )}
          </div>

          {!isStudentReadOnly && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold px-3 py-1 rounded-lg text-[11px] flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
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

      {/* IN-PORTAL AUTHENTICATED ATTACHMENT VIEWER MODAL */}
      {viewerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseViewer();
          }}
        >
          <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white font-sans animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md">
                    {previewFileName || attachment?.originalFileName || 'Attachment View'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
                    <span>{formatFileSize(attachment?.fileSize || 0)}</span>
                    <span>•</span>
                    <span className="uppercase text-cyan-400 font-bold">{fileCategory}</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center space-x-2 shrink-0">
                {fileCategory === 'image' && previewBlobUrl && (
                  <div className="hidden sm:flex items-center bg-slate-800/80 border border-slate-700 rounded-lg p-0.5 space-x-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.25, z - 0.25))}
                      className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setZoomLevel(1); setRotation(0); }}
                      className="px-1.5 py-0.5 text-[10px] font-mono hover:bg-slate-700 rounded text-slate-300"
                      title="Reset Zoom"
                    >
                      {Math.round(zoomLevel * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                      className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDownloadAttachment}
                  disabled={isDownloading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                  title="Download File"
                >
                  {isDownloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Download</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseViewer}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                  title="Close Viewer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[320px] max-h-[78vh] bg-slate-950/60">
              {viewerLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3 font-mono text-xs">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <span>Loading file securely from server storage...</span>
                </div>
              ) : viewerError ? (
                <div className="max-w-md w-full bg-red-950/70 border border-red-800/80 rounded-2xl p-6 text-center space-y-3 font-mono">
                  <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                  <div className="font-bold text-red-200 text-sm">Attachment Unavailable</div>
                  <p className="text-xs text-red-300/80 leading-relaxed">{viewerError}</p>
                  <p className="text-[11px] text-slate-400">
                    If this record was uploaded recently, please re-upload to store with complete persistent backup.
                  </p>
                  <button
                    type="button"
                    onClick={handleCloseViewer}
                    className="mt-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold font-sans"
                  >
                    Close
                  </button>
                </div>
              ) : fileCategory === 'image' && previewBlobUrl ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                  <img
                    src={previewBlobUrl}
                    alt={previewFileName}
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.15s ease-out'
                    }}
                    className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-xl"
                  />
                </div>
              ) : fileCategory === 'pdf' && previewBlobUrl ? (
                <iframe
                  src={previewBlobUrl}
                  title={previewFileName}
                  className="w-full h-[74vh] rounded-xl border border-slate-800 bg-slate-950"
                />
              ) : fileCategory === 'office' ? (
                <div className="max-w-md w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-6 text-center space-y-4">
                  <div className="w-14 h-14 bg-indigo-950/80 border border-indigo-700/80 rounded-2xl flex items-center justify-center text-indigo-400 mx-auto shadow-inner">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white">{previewFileName}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Microsoft Office Document ({formatFileSize(attachment?.fileSize || 0)})
                    </p>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    Word, PowerPoint, and Excel documents cannot be safely rendered inside standard browser tabs without cloud third-party converters.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadAttachment}
                      disabled={isDownloading}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>Download & Open in App</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseViewer}
                      className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-md w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-6 text-center space-y-4">
                  <div className="w-12 h-12 bg-cyan-950/80 border border-cyan-700/80 rounded-xl flex items-center justify-center text-cyan-400 mx-auto">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white">{previewFileName}</h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      File type: {previewMimeType || 'Binary file'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-300">
                    Click download below to save and open this file locally.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadAttachment}
                    disabled={isDownloading}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center justify-center space-x-2 mx-auto"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>
          </div>
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
