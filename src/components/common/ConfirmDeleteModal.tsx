import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  recordName: string;
  recordType: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'Are you sure you want to delete this record?',
  recordName,
  recordType,
  onConfirm,
  onCancel,
  isDeleting = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#080A0F]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#12161F] border border-[#252B36] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150 text-[#94A3B8]">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F1F5F9] leading-snug">Confirm Deletion</h3>
              <p className="text-xs text-rose-400 font-mono mt-0.5">PERMANENT / AUDITED ACTION</p>
            </div>
          </div>

          <button
            onClick={onCancel}
            aria-label="Close modal"
            className="text-[#64748B] hover:text-[#F1F5F9] p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[#171C26] transition-colors touch-target"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 bg-[#171C26] border border-[#252B36] rounded-xl p-3.5 text-xs">
          <p className="text-[#F1F5F9] font-semibold">{title}</p>
          <div className="border-t border-[#252B36] pt-2 flex flex-col space-y-1 font-mono text-[11px]">
            <div className="flex justify-between text-[#94A3B8]">
              <span>Category / Type:</span>
              <span className="text-[#A78BFA] font-bold uppercase">{recordType}</span>
            </div>
            <div className="flex justify-between text-[#94A3B8]">
              <span>Target Record:</span>
              <span className="text-[#F1F5F9] font-bold truncate max-w-[200px]">{recordName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="btn-action px-4 py-2 min-h-[44px] bg-[#171C26] hover:bg-[#202633] border border-[#252B36] text-[#F1F5F9] text-xs font-semibold rounded-xl transition-transform duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="btn-action px-5 py-2 min-h-[44px] bg-[#FB7185] hover:bg-rose-600 text-[#080A0F] font-extrabold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-transform duration-200"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Record'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
