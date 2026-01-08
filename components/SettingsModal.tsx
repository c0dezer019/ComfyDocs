
import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, ExternalLink, Trash2, Check, AlertCircle, Info, ChevronDown, ChevronRight, CreditCard, Eye, EyeOff } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  currentKey: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentKey }) => {
  const [inputValue, setInputValue] = useState(currentKey);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(!currentKey);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setInputValue(currentKey);
    if (isOpen && !currentKey) {
        setShowInstructions(true);
    }
  }, [currentKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError("Please enter a valid API Key.");
      return;
    }
    if (!trimmed.startsWith('AIza')) {
       setError("This doesn't look like a valid Google Gemini API Key (usually starts with 'AIza').");
       return;
    }
    
    onSave(trimmed);
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
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleBackdropClick}
    >
      <div 
          className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Key size={20} />
             </div>
             <h2 className="text-xl font-semibold text-white">API Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          <div className="space-y-4">
            <div className="bg-indigo-900/20 border border-indigo-900/50 rounded-lg p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
              <div className="text-sm text-indigo-200">
                <p className="font-semibold mb-1">Secure Local Storage</p>
                <p className="opacity-80 leading-relaxed">
                  Your API key is stored locally in your browser's localStorage. 
                  It is never uploaded to any server other than Google's Gemini API during requests.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={inputValue}
                  onChange={(e) => {
                      setInputValue(e.target.value);
                      setError(null);
                  }}
                  placeholder="AIzaSy..."
                  className={`w-full bg-slate-950 border ${error ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-indigo-500'} rounded-lg py-2.5 pl-4 pr-12 text-white placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all font-mono text-sm`}
                  autoFocus
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && (
                  <div className="flex items-center gap-2 mt-2 text-red-400 text-xs">
                      <AlertCircle size={12} />
                      <span>{error}</span>
                  </div>
              )}
            </div>

            {/* Instructions Accordion */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/30">
                <button 
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 text-sm font-medium text-slate-300 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <Info size={16} className="text-indigo-400"/> 
                        How to get a supported API Key
                    </span>
                    {showInstructions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                
                {showInstructions && (
                    <div className="p-4 text-sm text-slate-400 space-y-3 border-t border-slate-800 animate-in slide-in-from-top-2 duration-200">
                        <ol className="list-decimal list-inside space-y-3 ml-1">
                            <li>
                                Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink size={10} /></a>.
                            </li>
                            <li>
                                Click <strong>Create API Key</strong>. You can create one in a new project or select an existing Google Cloud project.
                            </li>
                            <li>
                                <strong>Setup Billing:</strong> For full access to models like Gemini 1.5 Pro, ensure your project is linked to a billing account.
                                <div className="mt-1.5 ml-0 sm:ml-4">
                                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs transition-colors border border-slate-700">
                                        <CreditCard size={12} />
                                        View Billing Documentation
                                    </a>
                                </div>
                            </li>
                            <li>
                                Copy the key (starts with <code>AIza</code>) and paste it above.
                            </li>
                        </ol>
                    </div>
                )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
            {currentKey ? (
                 <button
                    onClick={handleClear}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                    <Trash2 size={16} />
                    Remove Key
                </button>
            ) : (
                <div></div>
            )}
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              <Check size={16} />
              Save Key
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
