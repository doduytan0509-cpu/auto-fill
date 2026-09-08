import React, { useState } from 'react';
import { Search, Globe, Check, Copy, ExternalLink, HelpCircle, AlertCircle, ArrowRight, Layers, Mail, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { QuestionTypeBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';

export function FormInspectorView({ onUseFormInStudio }) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const handleInspect = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      toast.warning('Vui lòng nhập link Google Form');
      return;
    }

    setLoading(true);
    setFormData(null);
    try {
      const data = await api.inspectForm(url.trim());
      setFormData(data);
      toast.success(`Đã phân tích form thành công! Tìm thấy ${data.entry_count} câu hỏi/entry.`);
    } catch (err) {
      toast.error(err.message || 'Lỗi phân tích Google Form');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.info('Đã sao chép vào bộ nhớ tạm');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Search Bar Card */}
      <div className="glass-panel glass-panel-glow" style={{ padding: '1.75rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search style={{ color: 'var(--primary)' }} size={24} />
            Công cụ Phân tích Google Form (Form Inspector)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
            Nhập bất kỳ đường dẫn Google Form nào (dạng <code className="mono">/viewform</code>, <code className="mono">/formResponse</code> hoặc <code className="mono">/edit</code>) để tự động trích xuất toàn bộ mã <code className="mono">entry.&lt;id&gt;</code> và cấu trúc câu hỏi.
          </p>
        </div>

        <form onSubmit={handleInspect} style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Globe
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="https://docs.google.com/forms/d/e/.../viewform"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={16} />
            {loading ? 'Đang phân tích...' : 'Phân tích Form'}
          </button>
        </form>
      </div>

      {/* Results */}
      {formData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Overview Card */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '4px' }}>
                  {formData.title || 'Google Form (Không tiêu đề)'}
                </h3>
                {formData.description && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '800px' }}>
                    {formData.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <a
                    href={formData.viewform_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    <ExternalLink size={12} />
                    Mở Form trên Google
                  </a>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(JSON.stringify(formData.entry_list), 'entry-list-json')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    {copiedKey === 'entry-list-json' ? <Check size={12} /> : <Copy size={12} />}
                    Sao chép JSON ENTRY_LIST
                  </button>
                </div>
              </div>

              {onUseFormInStudio && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onUseFormInStudio(url, formData)}
                  style={{ gap: '6px' }}
                >
                  <span>Dùng Form này trong Studio</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>

            {/* Metric Chips */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
              }}
            >
              <div style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Tổng số Entry / Câu hỏi</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '2px' }}>
                  {formData.entry_count}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Số trang (Page Count)</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent-purple)', marginTop: '2px' }}>
                  {formData.page_count}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Default Page History</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-amber)', marginTop: '4px' }} className="mono">
                  {formData.default_page_history}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Thu thập Email</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: formData.collects_email ? '#6ee7b7' : 'var(--text-dim)', marginTop: '4px' }}>
                  {formData.collects_email ? 'Có yêu cầu' : 'Không yêu cầu'}
                </div>
              </div>
            </div>
          </div>

          {/* Entries List */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Danh sách Câu hỏi & Mã Entry ({formData.entries.length})</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Thứ tự xuất hiện từ trên xuống dưới
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {formData.entries.map((entry, idx) => (
                <div
                  key={entry.entry_id}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--text-dim)',
                          minWidth: '24px',
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <strong style={{ fontSize: '0.925rem', color: '#fff' }}>
                        {entry.question_title || '(Không có tiêu đề)'}
                        {entry.row_label && <span style={{ color: 'var(--accent-cyan)' }}> [{entry.row_label}]</span>}
                      </strong>
                      <QuestionTypeBadge typeName={entry.type_name} />
                      {entry.required && (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                          Bắt buộc *
                        </span>
                      )}
                      {entry.page > 0 && (
                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                          Trang {entry.page + 1}
                        </span>
                      )}
                    </div>

                    {/* Options if choices */}
                    {entry.options && entry.options.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {entry.options.map((opt, oIdx) => (
                          <span
                            key={oIdx}
                            style={{
                              fontSize: '0.725rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            • {opt}
                          </span>
                        ))}
                        {entry.has_other && (
                          <span
                            style={{
                              fontSize: '0.725rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(99, 102, 241, 0.1)',
                              color: '#a5b4fc',
                              fontStyle: 'italic',
                            }}
                          >
                            + Mục khác (Other)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Copy Entry ID button */}
                  <button
                    className="btn btn-ghost btn-sm mono"
                    onClick={() => copyToClipboard(entry.entry_id, entry.entry_id)}
                    style={{
                      fontSize: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                    }}
                    title="Sao chép mã entry"
                  >
                    {copiedKey === entry.entry_id ? (
                      <Check size={13} style={{ color: '#10b981' }} />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>{entry.entry_id}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
