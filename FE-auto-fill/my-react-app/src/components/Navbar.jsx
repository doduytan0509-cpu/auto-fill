import React, { useState, useEffect } from 'react';
import { Layers, FileSpreadsheet, Search, PlayCircle, Settings, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';

export function Navbar({ activeTab, setActiveTab, onOpenSettings, activeJobCount = 0 }) {
  const [serverOnline, setServerOnline] = useState(null);
  const [serverVersion, setServerVersion] = useState('');

  const checkHealth = async () => {
    try {
      const res = await api.health();
      setServerOnline(true);
      setServerVersion(res.version || '1.0');
    } catch {
      setServerOnline(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'studio', label: 'AutoFill Studio', icon: Layers, badge: null },
    { id: 'inspector', label: 'Form Inspector', icon: Search, badge: null },
    { id: 'excel', label: 'Excel Viewer', icon: FileSpreadsheet, badge: null },
    {
      id: 'jobs',
      label: 'Job Monitor',
      icon: PlayCircle,
      badge: activeJobCount > 0 ? `${activeJobCount} đang chạy` : null,
    },
  ];

  return (
    <header
      style={{
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(90deg, #ffffff 0%, #cbd5e1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                AutoFill Forms
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                PRO API
              </span>
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)', marginTop: '-2px' }}>
              Google Forms & Excel Automation
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  padding: '0.5rem 0.875rem',
                  fontSize: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  position: 'relative',
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '999px',
                      backgroundColor: '#06b6d4',
                      color: '#090d16',
                      fontWeight: 700,
                      marginLeft: '4px',
                      boxShadow: '0 0 8px rgba(6, 182, 212, 0.6)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Server status & settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onOpenSettings}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '0.4rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.775rem',
            }}
            title="Cấu hình kết nối Backend"
          >
            {serverOnline === true ? (
              <>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
                <span style={{ color: '#6ee7b7' }}>Backend Online</span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>v{serverVersion}</span>
              </>
            ) : serverOnline === false ? (
              <>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#f43f5e',
                    boxShadow: '0 0 8px #f43f5e',
                  }}
                />
                <span style={{ color: '#fda4af' }}>Backend Offline</span>
              </>
            ) : (
              <>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#94a3b8',
                  }}
                />
                <span style={{ color: 'var(--text-dim)' }}>Đang kết nối...</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenSettings}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
            title="Cài đặt hệ thống"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
