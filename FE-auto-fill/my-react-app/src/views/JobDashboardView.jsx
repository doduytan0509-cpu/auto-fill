import React, { useState, useEffect } from 'react';
import {
  PlayCircle,
  Pause,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  RefreshCw,
  Trash2,
  Eye,
  Plus,
  ArrowRight,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../api/client';
import { JobStatusBadge } from '../components/StatusBadge';
import { ProgressBar } from '../components/ProgressBar';
import { JobDetailModal } from '../components/JobDetailModal';
import { useToast } from '../components/Toast';

export function JobDashboardView({ onNewJobClick, selectedJobId, setSelectedJobId }) {
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalJobId, setModalJobId] = useState(null);

  const fetchJobs = async () => {
    try {
      const list = await api.listJobs();
      setJobs(list || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      setModalJobId(selectedJobId);
    }
  }, [selectedJobId]);

  const handlePauseJob = async (jobId, e) => {
    e.stopPropagation();
    try {
      await api.pauseJob(jobId);
      toast.warning(`Đã tạm dừng job #${jobId}`);
      fetchJobs();
    } catch (err) {
      toast.error(err.message || 'Lỗi tạm dừng job');
    }
  };

  const handleResumeJob = async (jobId, e) => {
    e.stopPropagation();
    try {
      await api.resumeJob(jobId);
      toast.success(`Tiếp tục gửi job #${jobId}`);
      fetchJobs();
    } catch (err) {
      toast.error(err.message || 'Lỗi tiếp tục job');
    }
  };

  const handleCancelJob = async (jobId, e) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có muốn huỷ job #${jobId}?`)) return;
    try {
      await api.cancelJob(jobId);
      toast.warning(`Đã gửi lệnh huỷ job #${jobId}`);
      fetchJobs();
    } catch (err) {
      toast.error(err.message || 'Lỗi huỷ job');
    }
  };

  const handleDeleteJob = async (jobId, e) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có muốn xoá job #${jobId}?`)) return;
    try {
      await api.deleteJob(jobId);
      toast.success(`Đã xoá job #${jobId}`);
      fetchJobs();
    } catch (err) {
      toast.error(err.message || 'Lỗi xoá job');
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (statusFilter === 'all') return true;
    return j.status === statusFilter;
  });

  const runningCount = jobs.filter((j) => j.status === 'running' || j.status === 'pending').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const totalFormsSent = jobs.reduce((sum, j) => sum + (j.sent || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner & Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Tổng số Jobs</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {jobs.length}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Đang chạy (Active)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '4px' }}>
            {runningCount}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#6ee7b7' }}>Hoàn thành</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
            {completedCount}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-purple)' }}>Tổng số Form đã gửi</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-purple)', marginTop: '4px' }}>
            {totalFormsSent}
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Filter size={16} style={{ color: 'var(--text-dim)' }} />
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Lọc trạng thái:</span>
          {['all', 'running', 'paused', 'completed', 'failed', 'cancelled'].map((status) => (
            <button
              key={status}
              className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(status)}
              style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}
            >
              {status === 'all'
                ? 'Tất cả'
                : status === 'running'
                ? 'Đang chạy'
                : status === 'paused'
                ? 'Tạm dừng'
                : status === 'completed'
                ? 'Hoàn thành'
                : status === 'failed'
                ? 'Thất bại'
                : 'Đã huỷ'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchJobs} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Làm mới
          </button>
          <button className="btn btn-primary btn-sm" onClick={onNewJobClick}>
            <Plus size={15} />
            Tạo Job mới
          </button>
        </div>
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <PlayCircle size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>Chưa có Job nào</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '450px', marginTop: '4px' }}>
              Hãy sử dụng AutoFill Studio để chọn file Excel và Google Form, sau đó bắt đầu chạy job tự động điền form.
            </p>
          </div>
          <button className="btn btn-primary" onClick={onNewJobClick} style={{ marginTop: '0.5rem' }}>
            <Plus size={16} />
            Đến AutoFill Studio
          </button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div
          className="glass-panel"
          style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}
        >
          Không có job nào phù hợp với bộ lọc "{statusFilter}".
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
          {filteredJobs.map((job) => {
            const isRunning = job.status === 'running' || job.status === 'pending';
            const isPaused = job.status === 'paused';
            const isActive = isRunning || isPaused;
            return (
              <div
                key={job.job_id}
                className="glass-panel"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                  border: job.status === 'running'
                    ? '1px solid rgba(99, 102, 241, 0.4)'
                    : isPaused
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : undefined,
                  boxShadow: job.status === 'running'
                    ? '0 0 15px rgba(99, 102, 241, 0.2)'
                    : isPaused
                    ? '0 0 15px rgba(245, 158, 11, 0.15)'
                    : undefined,
                }}
                onClick={() => setModalJobId(job.job_id)}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                        #{job.job_id}
                      </span>
                      {job.options?.dry_run && (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                          DRY RUN
                        </span>
                      )}
                    </div>
                    <h4
                      style={{
                        fontSize: '0.95rem',
                        color: '#fff',
                        marginTop: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '220px',
                      }}
                    >
                      {job.form_title || 'Google Form'}
                    </h4>
                  </div>
                  <JobStatusBadge status={job.status} />
                </div>

                {/* File & Sheet meta */}
                <div
                  style={{
                    fontSize: '0.775rem',
                    color: 'var(--text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FileSpreadsheet size={13} />
                  <span style={{ color: '#cbd5e1' }}>{job.file_name}</span>
                  <span>•</span>
                  <span>Sheet: {job.sheet_name}</span>
                </div>

                {/* Progress bar */}
                <ProgressBar
                  total={job.total}
                  success={job.success}
                  failed={job.failed}
                  height={6}
                  showLabel={true}
                />

                {/* Next action ticker if active */}
                {job.next_action && isActive && (
                  <div
                    style={{
                      fontSize: '0.725rem',
                      color: isPaused ? '#fcd34d' : 'var(--accent-cyan)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Clock size={11} className={isPaused ? '' : 'spin'} />
                    <span className="mono">{job.next_action}</span>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-subtle)',
                    marginTop: 'auto',
                  }}
                >
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {job.created_at ? new Date(job.created_at).toLocaleTimeString() : ''}
                  </span>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                    {job.status === 'running' && (
                      <button
                        className="btn btn-warning btn-sm"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.725rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.2)',
                          borderColor: 'rgba(245, 158, 11, 0.4)',
                          color: '#fcd34d',
                        }}
                        onClick={(e) => handlePauseJob(job.job_id, e)}
                        title="Tạm dừng gửi"
                      >
                        <Pause size={12} />
                        Tạm dừng
                      </button>
                    )}

                    {job.status === 'paused' && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.725rem',
                          background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                        }}
                        onClick={(e) => handleResumeJob(job.job_id, e)}
                        title="Tiếp tục gửi"
                      >
                        <Play size={12} />
                        Tiếp tục
                      </button>
                    )}

                    {isActive ? (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.725rem' }}
                        onClick={(e) => handleCancelJob(job.job_id, e)}
                        title="Huỷ job"
                      >
                        Huỷ
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.725rem', color: '#fda4af' }}
                        onClick={(e) => handleDeleteJob(job.job_id, e)}
                        title="Xoá job"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', fontSize: '0.725rem' }}
                      onClick={() => setModalJobId(job.job_id)}
                    >
                      <Eye size={13} />
                      Chi tiết
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalJobId && (
        <JobDetailModal
          jobId={modalJobId}
          isOpen={Boolean(modalJobId)}
          onClose={() => {
            setModalJobId(null);
            if (setSelectedJobId) setSelectedJobId(null);
          }}
          onJobDeleted={() => {
            fetchJobs();
          }}
        />
      )}
    </div>
  );
}
