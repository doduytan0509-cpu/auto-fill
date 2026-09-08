import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 6000),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} className="text-emerald" style={{ color: '#10b981', flexShrink: 0 }} />;
      case 'error':
        return <AlertCircle size={18} className="text-rose" style={{ color: '#f43f5e', flexShrink: 0 }} />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber" style={{ color: '#f59e0b', flexShrink: 0 }} />;
      default:
        return <Info size={18} className="text-primary" style={{ color: '#6366f1', flexShrink: 0 }} />;
    }
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {getIcon(t.type)}
            <div style={{ flex: 1, fontSize: '0.85rem', wordBreak: 'break-word' }}>{t.message}</div>
            <button
              onClick={() => removeToast(t.id)}
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px', height: 'auto' }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
