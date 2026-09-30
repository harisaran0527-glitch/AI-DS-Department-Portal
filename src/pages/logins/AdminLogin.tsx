import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../services/api';
import { Lock, Mail, ShieldAlert, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await API.login(identifier, password, 'ADMIN');

      if (res && res.user) {
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid credentials. Please check your Admin Identifier or Portal Password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex flex-col items-center justify-center mx-auto mb-2">
            <img 
              src="/images/avsec-salem-logo.png" 
              alt="AVSEC Salem Logo" 
              className="h-16 w-auto object-contain drop-shadow-[0_0_20px_rgba(99,102,241,0.5)] mb-1" 
            />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">AVSEC SALEM — ADMIN PORTAL</h1>
          <p className="text-xs text-slate-400 font-mono">FACULTY MAPPING & SYSTEM ACCESS CONTROL</p>
        </div>

        {errorMessage && (
          <div className="text-xs text-red-300 bg-red-950/80 border border-red-800 px-4 py-2.5 rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Admin Identifier</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Admin Email or Username"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Master Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>{isLoading ? 'Authenticating...' : 'Authenticate Admin Panel'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
