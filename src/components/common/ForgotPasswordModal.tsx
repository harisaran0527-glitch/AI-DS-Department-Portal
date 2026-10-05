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
    <div className="fixed inset-0 z-50 bg-[#080A0F]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="portal-modal w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 bg-[#12161F] border border-[#252B36] text-[#94A3B8]">
        <div className="flex justify-between items-start border-b border-[#252B36] pb-3">
          <div className="flex items-center space-x-2.5 text-[#A78BFA]">
            <div className="w-9 h-9 rounded-xl bg-[#171C26] border border-[#252B36] flex items-center justify-center text-[#A78BFA]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#F1F5F9] text-base">Portal Password Recovery</h3>
              <p className="text-[11px] text-[#94A3B8] font-mono">Role: {portalRole} Portal Access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-[#64748B] hover:text-[#F1F5F9] p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[#171C26] transition-colors touch-target"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-[#171C26] border border-[#252B36] p-4 rounded-xl space-y-3 text-xs">
          <div className="flex items-center space-x-2 text-amber-400 font-mono font-bold text-[11px]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Controlled Security Workflow</span>
          </div>

          <p className="text-[#94A3B8] leading-relaxed font-sans">
            {portalRole === 'STUDENT' && (
              <>
                Contact your assigned <strong className="text-[#F1F5F9]">Class Coordinator</strong> to reset your Student Portal password. Your coordinator will generate a new bcrypt password hash for your account.
              </>
            )}
            {portalRole === 'FACULTY' && (
              <>
                Contact the <strong className="text-[#F1F5F9]">Department Admin</strong> to reset your Faculty Portal password. Admin will generate a new secure password hash in HOD / Faculty Management.
              </>
            )}
            {portalRole === 'HOD' && (
              <>
                Contact the <strong className="text-[#F1F5F9]">Department Admin</strong> to reset your HOD Portal password. Admin will update your official credentials in HOD Management.
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
            className="btn-action bg-[#A78BFA] hover:bg-[#C4B5FD] text-[#080A0F] font-bold px-5 py-2.5 min-h-[44px] rounded-xl text-xs flex items-center space-x-1.5 transition-transform duration-200"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Understood</span>
          </button>
        </div>
      </div>
    </div>
  );
};
