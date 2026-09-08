import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  PlayCircle,
  Clock,
  Terminal,
  AlertTriangle,
  FileCode,
  ArrowRightLeft,
  XCircle,
  Trash2,
  RefreshCw,
  Sliders,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import { JobStatusBadge, MappingKindBadge } from './StatusBadge';
import { ProgressBar, CircularProgress } from './ProgressBar';
import { useToast } from './Toast';

export function JobDetailModal({ jobId, isOpen, onClose, onJobDeleted }) {
  const toast = useToast();
  const logsEndRef = useRef(null);

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs');
  const [payloads, setPayloads] = useState([]);
  const [loadingPayloads, setLoadingPayloads] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedPayloadIndex, setCopiedPayloadIndex] = useState(null);

  const fetchJobDetails = async () => {
    if (!jobId) return;
    try {
      const data = await api.getJob(jobId);
      setJob(data);
    } catch (err) {
      toast.error(`Lỗi tải thông tin job: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && jobId) {
      setLoading(true);
      fetchJobDetails();
      const interval = setInterval(() => {
        fetchJobDetails();
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isOpen, jobId]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current && activeTab === 'logs') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [job?.logs, autoScroll, activeTab]);

  useEffect(() => {
    if (activeTab === 'payloads' && jobId && payloads.length === 0) {
      loadPayloads();
    }
  }, [activeTab, jobId]);

  const loadPayloads = async () => {
    setLoadingPayloads(true);
    try {
      const res = await api.getJobPayloads(jobId, 50);
      setPayloads(res.payloads || []);
    } catch (err) {
      toast.error(`Lỗi tải payload: ${err.message}`);
    } finally {
      setLoadingPayloads(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn huỷ job này không?')) return;
    setCancelling(true);
    try {
      const updated = await api.cancelJob(jobId);
      setJob(updated);
      toast.warning('Đã gửi yêu cầu huỷ job');
    } catch (err) {
      toast.error(err.message || 'Không thể huỷ job');
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá job này khỏi bộ nhớ?')) return;
    setDeleting(true);
    try {
      await api.deleteJob(jobId);
      toast.success('Đã xoá job');
      if (onJobDeleted) onJobDeleted(jobId);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Không thể xoá job');
    } finally {
      setDeleting(false);
    }
  };

  const copyPayload = (payload, idx) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayloadIndex(idx);
    toast.info('Đã sao chép payload');
    setTimeout(() => setCopiedPayloadIndex(null), 2000);
  };

  if (!isOpen) return null;

  const total = job?.total || 0;
  const sent = job?.sent || 0;
  const success = job?.success || 0;
  const failed = job?.failed || 0;
  const progressPercent = total > 0 ? Math.round((sent / total) * 100) : 0;
  const isRunning = job?.status === 'running' || job?.status === 'pending';

  const filteredLogs = (job?.logs || []).filter((line) =>
    logFilter ? line.toLowerCase().includes(logFilter.toLowerCase()) : true
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>
              Chi tiết Job: <span className="mono" style={{ color: 'var(--primary)' }}>#{jobId}</span>
            </h3>
            {job && <JobStatusBadge status={job.status} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={fetchJobDetails} title="Làm mới">
              <RefreshCw size={15} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
          {loading && !job ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải dữ liệu job...
            </div>
          ) : job ? (
            <>
              {/* Job Summary Banner */}
              <div
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.25rem',
                  alignItems: 'center',
                }}
              >
                {/* Left metrics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    Form: <strong style={{ color: '#fff' }}>{job.form_title || 'Google Form'}</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    File: <span style={{ color: '#a5b4fc' }}>{job.file_name}</span> | Sheet:{' '}
                    <span style={{ color: '#6ee7b7' }}>{job.sheet_name}</span>
                  </div>
                  {job.options.dry_run && (
                    <div>
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                        DRY RUN (Chỉ tạo payload, không gửi)
                      </span>
                    </div>
                  )}

                  {/* Next action ticker */}
                  {job.next_action && isRunning && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: '#c7d2fe',
                        fontSize: '0.775rem',
                        fontWeight: 500,
                        marginTop: '4px',
                      }}
                    >
                      <Clock size={13} className="spin" />
                      <span>{job.next_action}</span>
                    </div>
                  )}
                </div>

                {/* Right Progress Gauges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', justifyContent: 'flex-end' }}>
                  <CircularProgress percentage={progressPercent} size={90} strokeWidth={8} label="Tiến độ" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '140px' }}>
                    <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Tổng:</span>
                      <strong>{total} form</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6ee7b7' }}>Thành công:</span>
                      <strong style={{ color: '#6ee7b7' }}>{success}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#fda4af' }}>Thất bại:</span>
                      <strong style={{ color: '#fda4af' }}>{failed}</strong>
                    </div>
                    {job.current_batch_target > 0 && isRunning && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--accent-cyan)',
                          borderTop: '1px solid var(--border-subtle)',
                          paddingTop: '4px',
                        }}
                      >
                        Đợt hiện tại: {job.current_batch_sent} / {job.current_batch_target}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar full width */}
              <ProgressBar total={total} success={success} failed={failed} height={8} />

              {/* Navigation Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '6px',
                }}
              >
                <button
                  className={`btn btn-sm ${activeTab === 'logs' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab('logs')}
                >
                  <Terminal size={14} />
                  <span>Nhật ký Logs ({job.logs?.length || 0})</span>
                </button>
                <button
                  className={`btn btn-sm ${activeTab === 'failures' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab('failures')}
                >
                  <AlertTriangle size={14} />
                  <span>Danh sách lỗi ({job.failures?.length || 0})</span>
                </button>
                <button
                  className={`btn btn-sm ${activeTab === 'mapping' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab('mapping')}
                >
                  <ArrowRightLeft size={14} />
                  <span>Ánh xạ Cột ({job.mapping?.length || 0})</span>
                </button>
                <button
                  className={`btn btn-sm ${activeTab === 'payloads' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab('payloads')}
                >
                  <FileCode size={14} />
                  <span>Payloads</span>
                </button>
              </div>

              {/* Tab 1: Terminal Logs */}
              {activeTab === 'logs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Lọc nhật ký..."
                      value={logFilter}
                      onChange={(e) => setLogFilter(e.target.value)}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', maxWidth: '240px' }}
                    />
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                      />
                      Tự động cuộn theo log mới
                    </label>
                  </div>

                  <div className="terminal-console" style={{ height: '320px' }}>
                    {filteredLogs.length === 0 ? (
                      <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', padding: '1rem' }}>
                        Chưa có log nào...
                      </div>
                    ) : (
                      filteredLogs.map((line, idx) => {
                        const isErr = line.includes('lỗi') || line.includes('gặp sự cố') || line.includes('Thất bại');
                        const isSuccess = line.includes('Thành công') || line.includes('HOÀN TẤT');
                        return (
                          <div key={idx} className="terminal-line">
                            <span className="terminal-time">[{idx + 1}]</span>
                            <span className={`terminal-text ${isErr ? 'error' : isSuccess ? 'success' : ''}`}>
                              {line}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}

              {/* Tab 2: Failures */}
              {activeTab === 'failures' && (
                <div>
                  {job.failures?.length === 0 ? (
                    <div
                      style={{
                        padding: '2.5rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <Check size={32} style={{ color: '#10b981', margin: '0 auto 8px' }} />
                      <div>Không có dòng dữ liệu nào bị lỗi. Toàn bộ gửi thành công!</div>
                    </div>
                  ) : (
                    <div className="table-container" style={{ maxHeight: '320px' }}>
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th style={{ width: '80px' }}>Dòng Excel</th>
                            <th>Nguyên nhân / Chi tiết lỗi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {job.failures.map((f, idx) => (
                            <tr key={idx}>
                              <td>
                                <span className="badge badge-danger">Dòng {f.row}</span>
                              </td>
                              <td style={{ color: '#fda4af' }} className="mono">
                                {f.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Mapping */}
              {activeTab === 'mapping' && (
                <div className="table-container" style={{ maxHeight: '320px' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Cột #</th>
                        <th>Tên Cột Excel</th>
                        <th>Mã Entry Google Form</th>
                        <th>Chế độ Mapping</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.mapping?.map((m, idx) => (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-dim)' }}>{m.column + 1}</td>
                          <td style={{ fontWeight: 600, color: '#fff' }}>{m.header}</td>
                          <td className="mono" style={{ color: 'var(--accent-cyan)' }}>
                            {m.entry_id}
                          </td>
                          <td>
                            <MappingKindBadge kind={m.kind} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 4: Payloads */}
              {activeTab === 'payloads' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      Danh sách {payloads.length} payload đã sinh
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={loadPayloads} disabled={loadingPayloads}>
                      <RefreshCw size={13} className={loadingPayloads ? 'spin' : ''} />
                      Tải lại
                    </button>
                  </div>

                  {payloads.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                      {loadingPayloads ? 'Đang tải payloads...' : 'Chưa có payload nào được lưu.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                      {payloads.map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '10px 14px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span className="badge badge-primary">Dòng dữ liệu {p.row}</span>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => copyPayload(p.payload, idx)}
                              style={{ padding: '2px 8px', fontSize: '0.725rem' }}
                            >
                              {copiedPayloadIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                              Sao chép JSON
                            </button>
                          </div>
                          <pre
                            className="mono"
                            style={{
                              fontSize: '0.75rem',
                              color: '#cbd5e1',
                              overflowX: 'auto',
                              margin: 0,
                              lineHeight: 1.4,
                            }}
                          >
                            {JSON.stringify(p.payload, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {job && job.status !== 'running' && job.status !== 'pending' && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 size={14} />
                {deleting ? 'Đang xoá...' : 'Xoá Job này'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {isRunning && (
              <button
                className="btn btn-danger"
                onClick={handleCancel}
                disabled={cancelling}
              >
                <XCircle size={16} />
                {cancelling ? 'Đang huỷ...' : 'Huỷ Job đang chạy'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
