import React, { useEffect, useState } from 'react';
import { usePluginStore } from '../../store';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toastMessage, toastType } = usePluginStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  return (
    <>
      {children}
      {visible && toastMessage && (
        <div
          className={`fixed bottom-4 right-4 z-[9999] px-4 py-2 rounded text-sm font-medium text-white shadow-lg ${
            toastType === 'error'
              ? 'bg-destructive'
              : toastType === 'success'
                ? 'bg-green-600'
                : 'bg-blue-600'
          }`}
        >
          {toastMessage}
        </div>
      )}
    </>
  );
}
