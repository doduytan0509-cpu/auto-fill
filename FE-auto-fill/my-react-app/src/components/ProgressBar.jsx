import React from 'react';

export function ProgressBar({ total = 0, success = 0, failed = 0, height = 8, showLabel = false }) {
  const safeTotal = total > 0 ? total : 1;
  const successPct = Math.min(100, Math.max(0, (success / safeTotal) * 100));
  const failedPct = Math.min(100 - successPct, Math.max(0, (failed / safeTotal) * 100));
  const totalSent = success + failed;
  const totalPct = Math.min(100, Math.round((totalSent / safeTotal) * 100));

  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginBottom: '4px',
          }}
        >
          <span>
            Tiến độ: <strong style={{ color: 'var(--text-main)' }}>{totalSent}</strong> / {total} ({totalPct}%)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: '#6ee7b7' }}>✓ {success}</span>
            {failed > 0 && <span style={{ color: '#fda4af' }}>✕ {failed}</span>}
          </div>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '999px',
          overflow: 'hidden',
          display: 'flex',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${successPct}%`,
            backgroundColor: '#10b981',
            transition: 'width 0.4s ease',
            height: '100%',
          }}
          title={`Thành công: ${success}`}
        />
        <div
          style={{
            width: `${failedPct}%`,
            backgroundColor: '#f43f5e',
            transition: 'width 0.4s ease',
            height: '100%',
          }}
          title={`Thất bại: ${failed}`}
        />
      </div>
    </div>
  );
}

export function CircularProgress({ percentage = 0, size = 120, strokeWidth = 10, label = 'Hoàn thành' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#gradient-progress)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          <defs>
            <linearGradient id="gradient-progress" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', color: '#fff' }}>
            {percentage}%
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</span>
        </div>
      </div>
    </div>
  );
}
