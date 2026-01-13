'use client';

import React, { useState } from 'react';
import { Lock, Unlock, AlertCircle } from 'lucide-react';

interface UnlockModalProps {
  isOpen: boolean;
  onUnlock: (password: string) => boolean; // Returns true if success
  onCancel: () => void;
}

export const UnlockModal: React.FC<UnlockModalProps> = ({ isOpen, onUnlock, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onUnlock(password);
    if (!success) {
      setError(true);
    } else {
      setPassword('');
      setError(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
            <Lock className="text-indigo-400" size={24} />
          </div>
          <h2 className="text-xl font-bold text-center text-white mb-2">Unlock API Key</h2>
          <p className="text-sm text-center text-slate-400 mb-6">
            Enter your password to decrypt your locally stored Gemini API Key.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="unlock-password" className="sr-only">
                Enter password to decrypt API key
              </label>
              <input
                id="unlock-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="Enter Password"
                aria-invalid={error}
                aria-describedby={error ? 'password-error' : undefined}
                className={`w-full bg-slate-950 border ${error ? 'border-red-500' : 'border-slate-700'} rounded-lg py-3 px-4 text-center text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all`}
              />
              {error && (
                <div
                  id="password-error"
                  className="flex items-center justify-center gap-2 mt-2 text-red-400 text-xs"
                >
                  <AlertCircle size={12} aria-hidden="true" />
                  <span>Incorrect Password</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!password}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Unlock size={18} />
              Unlock
            </button>
          </form>

          <button
            onClick={onCancel}
            className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
          >
            Cancel (Stay Offline)
          </button>
        </div>
      </div>
    </div>
  );
};
