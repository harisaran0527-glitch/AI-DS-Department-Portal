import React from 'react';
import { Lock, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  portalRole: 'STUDENT' | 'FACULTY' | 'HOD' | 'ADMIN';
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  portalRole,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100">
        <div className="flex justify-between items-start border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5 text-indigo-400">
            <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Portal Password Recovery</h3>
              <p className="text-[11px] text-slate-400 font-mono">Role: {portalRole} Portal Access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
          <div className="flex items-center space-x-2 text-amber-400 font-mono font-bold text-[11px]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Controlled Security Workflow</span>
          </div>

          <p className="text-slate-300 leading-relaxed font-sans">
            {portalRole === 'STUDENT' && (
              <>
                Contact your assigned <strong className="text-white">Class Coordinator</strong> to reset your Student Portal password. Your coordinator will generate a new bcrypt password hash for your account.
              </>
            )}
            {portalRole === 'FACULTY' && (
              <>
                Contact the <strong className="text-white">Department Admin</strong> to reset your Faculty Portal password. Admin will generate a new secure password hash in HOD / Faculty Management.
              </>
            )}
            {portalRole === 'HOD' && (
              <>
                Contact the <strong className="text-white">Department Admin</strong> to reset your HOD Portal password. Admin will update your official credentials in HOD Management.
              </>
            )}
            {portalRole === 'ADMIN' && (
              <>
                Admin credentials are configured in system environment variables. Please check the system administrator settings.
              </>
            )}
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Understood</span>
          </button>
        </div>
      </div>
    </div>
  );
};
