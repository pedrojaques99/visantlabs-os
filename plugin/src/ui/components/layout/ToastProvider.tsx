import React, { useEffect, useState } from 'react';
import { usePluginStore } from '../../store';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toastMessage, toastType } = usePluginStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const Icon = toastType === 'error' ? AlertCircle : toastType === 'success' ? CheckCircle2 : Info;

  return (
    <>
      {children}
      {visible && toastMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed bottom-4 right-4 z-[9999] flex items-start gap-2 max-w-xs px-3 py-2.5 rounded-lg text-xs font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toastType === 'error'
              ? 'bg-destructive'
              : toastType === 'success'
              ? 'bg-green-600'
              : 'bg-blue-600'
          }`}
        >
          <Icon size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
}
