'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldCheck,
  ExternalLink,
  Trash2,
  Check,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, password?: string) => void;
  currentKey: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentKey,
}) => {
  const [inputValue, setInputValue] = useState(currentKey);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(!currentKey);
  const [showKey, setShowKey] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setInputValue(currentKey);
    setPassword('');
    setConfirmPassword('');
    if (isOpen && !currentKey) {
      setShowInstructions(true);
    }
  }, [currentKey, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
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
  }, [isOpen, onClose]);

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

  const validatePasswordStrength = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd))
      return 'Password must contain at least one number or special character.';
    return null;
  };

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError('Please enter a valid API Key.');
      return;
    }
    if (!trimmed.startsWith('AIza')) {
      setError("This doesn't look like a valid Google Gemini API Key (starts with 'AIza').");
      return;
    }

    if (!password) {
      setError('Please create a password to encrypt your key.');
      return;
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    onSave(trimmed, password);
    setError(null);
    onClose();
  };

  const handleClear = () => {
    setInputValue('');
    onSave('');
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 transition-opacity duration-150"
      onClick={handleBackdropClick}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-card border border-border bg-surface shadow-preview"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-muted p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-icon bg-accent-subtle p-2 text-status-info">
              <Lock size={20} />
            </div>
            <h2 id="settings-modal-title" className="font-heading text-xl font-semibold text-text">
              Secure Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-button p-1 text-text-secondary transition-colors hover:bg-surface hover:text-text"
            aria-label="Close secure configuration"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-card border border-sky-200 bg-sky-50 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-status-info" />
              <div className="text-sm text-text-secondary">
                <p className="font-semibold mb-1">Encrypted Local Storage (BYOK)</p>
                <p className="opacity-80 leading-relaxed text-xs">
                  Your key is encrypted with your password and stored locally in your browser.
                  <br />
                  <br />
                  <span className="font-bold text-status-info">Warning:</span> You will need to
                  enter this password whenever you revisit the app to unlock your key.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* API Key Input */}
              <div>
                <label
                  htmlFor="gemini-api-key"
                  className="mb-2 block text-sm font-medium text-text"
                >
                  Google Gemini API Key
                </label>
                <div className="relative">
                  <input
                    id="gemini-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setError(null);
                    }}
                    placeholder="AIzaSy..."
                    className="w-full rounded-input border border-border bg-surface py-2.5 pl-4 pr-12 font-mono text-sm text-text shadow-subtle outline-none transition-colors focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-button p-1 text-text-secondary transition-colors hover:text-text"
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showKey ? (
                      <EyeOff size={16} aria-hidden="true" />
                    ) : (
                      <Eye size={16} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password Input */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="create-password"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-secondary"
                  >
                    Create Password
                  </label>
                  <input
                    id="create-password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Min 8 chars..."
                    className="w-full rounded-input border border-border bg-surface px-4 py-2.5 text-sm text-text shadow-subtle outline-none transition-colors focus:border-accent"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-secondary"
                  >
                    Confirm
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Repeat..."
                    className="w-full rounded-input border border-border bg-surface px-4 py-2.5 text-sm text-text shadow-subtle outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-2 flex items-center gap-2 text-xs text-status-error" role="alert">
                <AlertCircle size={12} />
                <span>{error}</span>
              </div>
            )}

            {/* Instructions Accordion */}
            <div className="overflow-hidden rounded-input border border-border bg-surface-muted">
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="flex w-full items-center justify-between bg-surface-muted p-3 text-sm font-medium text-text transition-colors hover:bg-surface"
              >
                <span className="flex items-center gap-2">
                  <Info size={16} className="text-status-info" />
                  How to get an API Key
                </span>
                {showInstructions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {showInstructions && (
                <div className="space-y-3 border-t border-border p-4 text-sm text-text-secondary">
                  <ol className="list-decimal list-inside space-y-3 ml-1">
                    <li>
                      Access the{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-status-info hover:underline"
                      >
                        Google AI Studio <ExternalLink size={10} />
                      </a>{' '}
                      dashboard.
                    </li>
                    <li>Create a new API Key for your project.</li>
                    <li>
                      <strong>Setup Billing:</strong> Forensic documentation requires a linked
                      billing account on the GCP project for Gemini 1.5 Pro access.
                      <div className="mt-1.5 ml-0 sm:ml-4">
                        <a
                          href="https://ai.google.dev/gemini-api/docs/billing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-status-info transition-colors hover:border-accent"
                        >
                          <CreditCard size={12} />
                          Billing Docs
                        </a>
                      </div>
                    </li>
                    <li>
                      Paste the <code>AIza</code> token into the field above.
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface-muted p-4 sm:justify-between sm:p-6">
          {currentKey ? (
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-button px-4 py-2 text-sm font-medium text-status-error transition-colors hover:bg-red-50"
            >
              <Trash2 size={16} />
              Reset Key
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-button px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-button bg-accent px-4 py-2 text-sm font-medium text-text shadow-subtle transition-colors hover:bg-accent-hover"
            >
              <Check size={16} />
              Encrypt & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
