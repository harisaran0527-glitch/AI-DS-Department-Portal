import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../../services/api';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  FileCheck
} from 'lucide-react';

export interface CertificatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  certId: string;
  certificateTitle: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  onDownload?: () => void;
}

export const CertificatePreviewModal: React.FC<CertificatePreviewModalProps> = ({
  isOpen,
  onClose,
  certId,
  certificateTitle,
  fileName: initialFileName = '',
  fileSize: initialFileSize,
  mimeType: initialMimeType = '',
  onDownload
}) => {
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState(initialFileName);
  const [fileSize, setFileSize] = useState<number | undefined>(initialFileSize);
  const [contentType, setContentType] = useState(initialMimeType);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);

  // Determine file format category
  const isPdf = contentType.toLowerCase().includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
  const isImage = contentType.toLowerCase().startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(fileName);

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const loadCertificate = useCallback(async () => {
    if (!certId) return;
    setLoading(true);
    setError(null);
    setZoomLevel(1);
    setRotation(0);

    try {
      const res = await API.getCertificateBlob(certId);
      const url = URL.createObjectURL(res.blob);
      setBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      if (res.fileName) setFileName(res.fileName);
      if (res.contentType) setContentType(res.contentType);
      if (res.fileSize) setFileSize(res.fileSize);

      const isDocPdf = (res.contentType || '').toLowerCase().includes('pdf') || (res.fileName || '').toLowerCase().endsWith('.pdf');
      if (isDocPdf) {
        setTotalPages(1);
      }
    } catch (err: any) {
      console.error('[CertificatePreviewModal] Failed to load certificate:', err);
      setError(err?.message || 'Certificate document could not be loaded from secure storage.');
    } finally {
      setLoading(false);
    }
  }, [certId]);

  useEffect(() => {
    if (isOpen) {
      loadCertificate();
    } else {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setIsFullscreen(false);
      setZoomLevel(1);
      setRotation(0);
      setError(null);
    }
  }, [isOpen, loadCertificate]);

  // Clean up Object URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Keyboard shortcut handler (Escape to close, +/- to zoom, 0 to reset)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel(z => Math.min(3, +(z + 0.25).toFixed(2)));
      } else if (e.key === '-') {
        setZoomLevel(z => Math.max(0.5, +(z - 0.25).toFixed(2)));
      } else if (e.key === '0') {
        setZoomLevel(1);
        setRotation(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().catch(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().catch(() => {
        setIsFullscreen(false);
      });
    }
  };

  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (!certId) return;
    setIsDownloading(true);
    try {
      await API.downloadCertificateBlob(certId, fileName || `${certificateTitle}.pdf`);
    } catch (err: any) {
      console.error('[CertificatePreviewModal] Download error:', err);
      setError(err?.message || 'Failed to download certificate.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(z => Math.min(3, +(z + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomLevel(z => Math.max(0.5, +(z - 0.25).toFixed(2)));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation(r => (r + 90) % 360);
  };

  if (!isOpen) return null;

  const formattedSize = formatFileSize(fileSize);
  const formatTag = isPdf ? 'PDF' : isImage ? (fileName.split('.').pop() || 'IMG').toUpperCase() : 'DOC';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-preview-title"
    >
      <div
        ref={modalContainerRef}
        className={`w-full max-w-6xl h-full sm:h-[88vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden shadow-2xl transition-all border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${
          isFullscreen ? 'fixed inset-0 max-w-none h-full rounded-none z-50' : ''
        }`}
      >
        {/* HEADER TOOLBAR */}
        <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 shrink-0 gap-2">
          {/* LEFT: File Icon + Title + Meta */}
          <div className="flex items-center space-x-2.5 min-w-0">
            {/* File Format Badge / Icon */}
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs shadow-sm ${
                isPdf
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              }`}
            >
              {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            </div>

            <div className="min-w-0">
              <h3
                id="cert-preview-title"
                className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[160px] sm:max-w-xs md:max-w-md lg:max-w-lg"
                title={fileName || certificateTitle}
              >
                {fileName || certificateTitle}
              </h3>
              <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center space-x-1.5 truncate">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatTag}</span>
                {formattedSize && (
                  <>
                    <span>•</span>
                    <span>{formattedSize}</span>
                  </>
                )}
                {certificateTitle && certificateTitle !== fileName && (
                  <>
                    <span className="hidden md:inline">•</span>
                    <span className="hidden md:inline truncate">{certificateTitle}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Controls (Zoom, Rotate, Fullscreen, Download, Close) */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            {/* Multipage PDF Sidebar Toggle */}
            {isPdf && (
              <button
                type="button"
                onClick={() => setSidebarOpen(s => !s)}
                className={`p-1.5 sm:p-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  sidebarOpen
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title={sidebarOpen ? 'Hide pages' : 'Show pages'}
                aria-label="Toggle PDF pages"
              >
                {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>
            )}

            {/* Zoom Out */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5 || loading || !blobUrl}
              className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Zoom out (-)"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            {/* Zoom % / Fit to Page */}
            <button
              type="button"
              onClick={handleResetZoom}
              disabled={loading || !blobUrl}
              className="px-2 py-1 rounded-lg text-[11px] font-mono font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 transition-colors cursor-pointer"
              title="Click to reset zoom (100% / Fit to page)"
            >
              {Math.round(zoomLevel * 100)}%
            </button>

            {/* Zoom In */}
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3 || loading || !blobUrl}
              className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Zoom in (+)"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Rotate (Images only) */}
            {isImage && (
              <button
                type="button"
                onClick={handleRotate}
                disabled={loading || !blobUrl}
                className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                title="Rotate 90°"
                aria-label="Rotate image"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || loading || !blobUrl}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Download certificate file"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close viewer (Esc)"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* BODY AREA (Optional PDF Sidebar + Main Canvas) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* LEFT THUMBNAIL SIDEBAR (For Multipage PDFs / Navigation) */}
          {isPdf && sidebarOpen && (
            <aside className="w-36 sm:w-44 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 flex flex-col gap-2 overflow-y-auto shrink-0 transition-all">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                Pages
              </div>
              <div className="flex flex-col gap-2">
                {[1, 2, 3].slice(0, Math.max(totalPages, 1)).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`flex flex-col items-center p-2 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                      currentPage === p
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 shadow-sm font-bold ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="w-full h-16 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-[10px] mb-1">
                      <FileCheck className="w-4 h-4 text-indigo-500/70" />
                    </div>
                    <span>Page {p}</span>
                  </button>
                ))}
              </div>
            </aside>
          )}

          {/* MAIN PREVIEW CANVAS */}
          {/* Light Mode: bg-slate-100 (light grey) | Dark Mode: dark:bg-[#0B101B] (dark slate) */}
          <main className="flex-1 h-full overflow-auto bg-slate-100 dark:bg-[#0B101B] relative flex items-center justify-center p-2 sm:p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center space-y-3 p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Loading verified certificate document...
                </p>
                <p className="text-[11px] font-mono text-slate-400">
                  Resolving secure authenticated storage stream
                </p>
              </div>
            ) : error ? (
              <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-6 text-center space-y-3 shadow-xl">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Unable to display certificate</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {error}
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={loadCertificate}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Loading</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : isImage && blobUrl ? (
              /* IMAGE PREVIEW: Centered, Fit to Page, Zoom & Rotate, Crisp proportions */
              <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                <img
                  src={blobUrl}
                  alt={fileName || certificateTitle}
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out',
                    maxHeight: zoomLevel <= 1 ? '72vh' : 'none',
                    maxWidth: zoomLevel <= 1 ? '100%' : 'none'
                  }}
                  className="object-contain rounded-lg shadow-xl border border-slate-300/60 dark:border-slate-800 bg-white"
                />
              </div>
            ) : isPdf && blobUrl ? (
              /* PDF PREVIEW: Fit to page iframe with current page */
              <div className="w-full h-full flex items-center justify-center overflow-hidden">
                <iframe
                  src={`${blobUrl}#page=${currentPage}&zoom=${Math.round(zoomLevel * 100)}&view=FitH`}
                  title={fileName || certificateTitle}
                  className="w-full h-full rounded-none sm:rounded-xl border border-slate-300/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 shadow-inner"
                />
              </div>
            ) : (
              /* OTHER FORMATS FALLBACK */
              <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3 shadow-xl">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{fileName || certificateTitle}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  This document format ({contentType || 'file'}) can be downloaded and opened with your system viewer.
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 mx-auto shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Document</span>
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
