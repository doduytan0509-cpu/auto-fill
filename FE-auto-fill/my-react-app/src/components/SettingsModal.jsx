import React, { useState, useEffect } from 'react';
import { X, Server, Activity, Check, RefreshCw, Sliders, ShieldCheck } from 'lucide-react';
import { getApiBaseUrl, setApiBaseUrl, api } from '../api/client';
import { useToast } from './Toast';

export function SettingsModal({ isOpen, onClose, onServerUrlChanged }) {
  const toast = useToast();
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [defaults, setDefaults] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setApiUrl(getApiBaseUrl());
      setTestResult(null);
      loadDefaults();
    }
  }, [isOpen]);

  const loadDefaults = async () => {
    try {
      const data = await api.getDefaults();
      setDefaults(data);
    } catch {
      // ignore
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const res = await api.health(apiUrl);
      const latency = Math.round(performance.now() - start);
      setTestResult({
        success: true,
        latency,
        version: res.version,
        message: `Kết nối thành công! Phiên bản: v${res.version} (${latency}ms)`,
      });
      toast.success(`Đã kết nối máy chủ (${latency}ms)`);
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Không thể kết nối',
      });
      toast.error('Kết nối máy chủ thất bại');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const saved = setApiBaseUrl(apiUrl);
    toast.success(`Đã lưu cấu hình máy chủ: ${saved}`);
    if (onServerUrlChanged) onServerUrlChanged(saved);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.15rem' }}>Cấu hình Máy chủ & Kết nối</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              <span>Địa chỉ Backend API</span>
              <span className="helper">Mặc định: http://127.0.0.1:8000</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTestConnection}
                disabled={testing || !apiUrl.trim()}
              >
                {testing ? <RefreshCw size={14} className="spin" /> : <Activity size={14} />}
                Kiểm tra
              </button>
            </div>
          </div>

          {testResult && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                color: testResult.success ? '#6ee7b7' : '#fda4af',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {testResult.success ? <ShieldCheck size={16} /> : <X size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {defaults && (
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                <Sliders size={14} />
                <span>THÔNG SỐ MẶC ĐỊNH TRÊN SERVER</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.75rem' }}>
                <div style={{ padding: '8px', background: 'var(--bg-input)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Delay giữa 2 form</div>
                  <div style={{ color: '#a5b4fc', fontWeight: 600, marginTop: '2px' }}>
                    {defaults.delay_min}s - {defaults.delay_max}s
                  </div>
                </div>
                <div style={{ padding: '8px', background: 'var(--bg-input)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Kích thước đợt</div>
                  <div style={{ color: '#67e8f9', fontWeight: 600, marginTop: '2px' }}>
                    {defaults.batch_min} - {defaults.batch_max} form
                  </div>
                </div>
                <div style={{ padding: '8px', background: 'var(--bg-input)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-dim)' }}>Nghỉ giữa các đợt</div>
                  <div style={{ color: '#fcd34d', fontWeight: 600, marginTop: '2px' }}>
                    {defaults.pause_min}s - {defaults.pause_max}s
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Đóng
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Check size={16} />
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
