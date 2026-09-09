'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Lock, Unlock, AlertCircle } from 'lucide-react';

interface UnlockModalProps {
  isOpen: boolean;
  onUnlock: (password: string) => boolean; // Returns true if success
  onCancel: () => void;
}

export const UnlockModal: React.FC<UnlockModalProps> = ({ isOpen, onUnlock, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      const activeElement = document.activeElement;

      if (!firstElement || !lastElement) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (
        event.shiftKey &&
        (activeElement === firstElement ||
          activeElement === dialogRef.current ||
          !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement ||
          activeElement === dialogRef.current ||
          !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (isOpen) {
      // Capture and move focus only for the closed-to-open transition. Keeping
      // this out of parent-driven rerenders prevents an in-progress form edit
      // from having focus pulled back to the dialog container.
      if (wasOpenRef.current) return;
      wasOpenRef.current = true;
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialogRef.current?.focus();
      return;
    }

    if (!wasOpenRef.current) return;

    wasOpenRef.current = false;
    const opener = returnFocusRef.current;
    returnFocusRef.current = null;

    // Let React finish the close render, but do not steal focus if the parent
    // intentionally moved it while responding to the close callback.
    const frame = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (
        opener?.isConnected &&
        (activeElement === document.body || activeElement === document.documentElement)
      ) {
        opener.focus();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

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
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 transition-opacity duration-150">
      <div
        ref={dialogRef}
        className="w-full max-w-sm overflow-hidden rounded-card border border-border bg-surface shadow-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlock-modal-title"
        tabIndex={-1}
      >
        <div className="p-6">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-subtle">
            <Lock className="text-accent" size={24} />
          </div>
          <h2
            id="unlock-modal-title"
            className="mb-2 text-center font-heading text-xl font-semibold text-text"
          >
            Unlock API Key
          </h2>
          <p className="mb-6 text-center text-sm text-text-secondary">
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
                className={`w-full rounded-input border bg-surface px-4 py-3 text-center text-text shadow-subtle outline-none transition-colors focus:border-accent ${error ? 'border-red-400' : 'border-border'}`}
              />
              {error && (
                <div
                  id="password-error"
                  className="mt-2 flex items-center justify-center gap-2 text-xs text-status-error"
                  role="alert"
                >
                  <AlertCircle size={12} aria-hidden="true" />
                  <span>Incorrect Password</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!password}
              className="flex w-full items-center justify-center gap-2 rounded-button bg-accent py-3 font-semibold text-text shadow-subtle transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Unlock size={18} />
              Unlock
            </button>
          </form>

          <button
            onClick={onCancel}
            className="mt-4 w-full rounded-button text-xs text-text-secondary underline underline-offset-2 transition-colors hover:text-text"
          >
            Cancel (Stay Offline)
          </button>
        </div>
      </div>
    </div>
  );
};
