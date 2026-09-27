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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-800/80 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-snug">Confirm Deletion</h3>
              <p className="text-xs text-red-300/90 font-mono mt-0.5">PERMANENT / AUDITED ACTION</p>
            </div>
          </div>

          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs">
          <p className="text-slate-300 font-semibold">{title}</p>
          <div className="border-t border-slate-800/80 pt-2 flex flex-col space-y-1 font-mono text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Category / Type:</span>
              <span className="text-cyan-400 font-bold uppercase">{recordType}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Target Record:</span>
              <span className="text-white font-bold truncate max-w-[200px]">{recordName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-red-600/30 flex items-center space-x-2 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Record'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
