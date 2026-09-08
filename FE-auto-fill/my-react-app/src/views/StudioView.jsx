import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Search,
  FileSpreadsheet,
  Sliders,
  Play,
  Check,
  AlertTriangle,
  FileCheck,
  Upload,
  RefreshCw,
  Eye,
  ArrowRight,
  Info,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../api/client';
import { QuestionTypeBadge, MappingKindBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';

export function StudioView({ onJobCreated, initialFormUrl = '', initialFormData = null, initialFile = null }) {
  const toast = useToast();
  const fileInputRef = useRef(null);

  // Steps state: 1: Form, 2: Excel, 3: Options, 4: Preview & Launch
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Form
  const [formUrl, setFormUrl] = useState(initialFormUrl);
  const [inspecting, setInspecting] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [showFormEntries, setShowFormEntries] = useState(false);

  // Step 2: Excel
  const [excelFile, setExcelFile] = useState(initialFile);
  const [sheetName, setSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [excelData, setExcelData] = useState(null);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 3: Timing & Options
  const [timing, setTiming] = useState({
    delay_min: 1.5,
    delay_max: 4.0,
    batch_min: 3,
    batch_max: 8,
    pause_min: 20.0,
    pause_max: 60.0,
  });
  const [mappingMode, setMappingMode] = useState('position');
  const [customEntryList, setCustomEntryList] = useState('');
  const [pageHistory, setPageHistory] = useState('auto');
  const [checkboxDelimiter, setCheckboxDelimiter] = useState(';');
  const [startRow, setStartRow] = useState(1);
  const [maxRows, setMaxRows] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [stopOnError, setStopOnError] = useState(false);

  // Step 4: Preview simulation
  const [jobPreview, setJobPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submittingJob, setSubmittingJob] = useState(false);

  useEffect(() => {
    loadDefaults();
  }, []);

  useEffect(() => {
    if (initialFormUrl && !formData) {
      handleInspectForm(initialFormUrl);
    }
  }, [initialFormUrl]);

  const loadDefaults = async () => {
    try {
      const def = await api.getDefaults();
      setTiming({
        delay_min: def.delay_min,
        delay_max: def.delay_max,
        batch_min: def.batch_min,
        batch_max: def.batch_max,
        pause_min: def.pause_min,
        pause_max: def.pause_max,
      });
    } catch {
      // ignore
    }
  };

  // Step 1 handler
  const handleInspectForm = async (targetUrl = formUrl) => {
    if (!targetUrl.trim()) {
      toast.warning('Vui lòng nhập đường dẫn Google Form');
      return;
    }
    setInspecting(true);
    try {
      const data = await api.inspectForm(targetUrl.trim());
      setFormData(data);
      setFormUrl(targetUrl.trim());
      toast.success(`Đã nhận diện form: "${data.title || 'Google Form'}" (${data.entry_count} câu hỏi)`);
      if (currentStep === 1) setCurrentStep(2);
    } catch (err) {
      toast.error(err.message || 'Không thể phân tích Google Form');
    } finally {
      setInspecting(false);
    }
  };

  // Step 2 handler
  const handleLoadExcel = async (file, chosenSheet = '', chosenHeader = headerRow) => {
    if (!file) return;
    setLoadingExcel(true);
    try {
      const data = await api.previewExcel({
        file,
        sheetName: chosenSheet || null,
        headerRow: Number(chosenHeader) || 1,
        limit: 5,
      });
      setExcelData(data);
      setSheetName(data.sheet_name);
      setExcelFile(file);
      toast.success(`Đã nạp file: ${file.name} (Sheet: ${data.sheet_name})`);
      if (currentStep === 2) setCurrentStep(3);
    } catch (err) {
      toast.error(err.message || 'Lỗi đọc file Excel');
    } finally {
      setLoadingExcel(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.match(/\.(xlsx|xlsm)$/i)) {
      handleLoadExcel(file);
    } else {
      toast.error('Vui lòng chọn file Excel định dạng .xlsx hoặc .xlsm');
    }
  };

  // Step 4 handler: Preview Simulation
  const handleGeneratePreview = async () => {
    if (!formData || !excelFile) {
      toast.warning('Vui lòng hoàn thành bước chọn Form và Excel');
      return;
    }
    setLoadingPreview(true);
    setJobPreview(null);
    try {
      const res = await api.previewJob({
        file: excelFile,
        form_url: formUrl,
        sheet_name: sheetName || null,
        header_row: Number(headerRow) || 1,
        mapping_mode: mappingMode,
        entry_list: customEntryList.trim() || null,
        page_history: pageHistory,
        checkbox_delimiter: checkboxDelimiter,
        start_row: Number(startRow) || 1,
        limit: 3,
      });
      setJobPreview(res);
      setCurrentStep(4);
      toast.info('Đã tạo mô phỏng ánh xạ cột và payload');
    } catch (err) {
      toast.error(err.message || 'Lỗi tạo mô phỏng Job');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Launch job
  const handleLaunchJob = async () => {
    if (!excelFile || !formUrl) {
      toast.error('Thiếu thông tin Form hoặc File Excel');
      return;
    }

    setSubmittingJob(true);
    try {
      const created = await api.createJob({
        file: excelFile,
        form_url: formUrl,
        sheet_name: sheetName || null,
        header_row: Number(headerRow) || 1,
        delay_min: Number(timing.delay_min),
        delay_max: Number(timing.delay_max),
        batch_min: Number(timing.batch_min),
        batch_max: Number(timing.batch_max),
        pause_min: Number(timing.pause_min),
        pause_max: Number(timing.pause_max),
        mapping_mode: mappingMode,
        entry_list: customEntryList.trim() || null,
        page_history: pageHistory,
        checkbox_delimiter: checkboxDelimiter,
        start_row: Number(startRow) || 1,
        max_rows: maxRows ? Number(maxRows) : null,
        dry_run: dryRun,
        stop_on_error: stopOnError,
      });

      toast.success(`Đã khởi tạo Job #${created.job_id}! Chuyển sang Trình giám sát...`);
      if (onJobCreated) {
        onJobCreated(created.job_id);
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khởi chạy Job');
    } finally {
      setSubmittingJob(false);
    }
  };

  const steps = [
    { num: 1, label: 'Google Form', ready: Boolean(formData) },
    { num: 2, label: 'Nạp Excel', ready: Boolean(excelData) },
    { num: 3, label: 'Cấu hình Timing & Mapping', ready: true },
    { num: 4, label: 'Xem trước & Khởi chạy', ready: Boolean(jobPreview) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Wizard Progress Stepper */}
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
          {steps.map((s, idx) => (
            <React.Fragment key={s.num}>
              <button
                className={`btn btn-sm ${currentStep === s.num ? 'btn-primary' : s.ready ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setCurrentStep(s.num)}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: currentStep === s.num ? '#fff' : s.ready ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                    color: currentStep === s.num ? 'var(--primary)' : s.ready ? '#090d16' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {s.ready && currentStep !== s.num ? <Check size={11} /> : s.num}
                </span>
                <span>{s.label}</span>
              </button>
              {idx < steps.length - 1 && <span style={{ color: 'var(--text-dim)' }}>→</span>}
            </React.Fragment>
          ))}
        </div>

        <div>
          {currentStep < 4 ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (currentStep === 3) handleGeneratePreview();
                else setCurrentStep((p) => p + 1);
              }}
              disabled={
                (currentStep === 1 && !formData) ||
                (currentStep === 2 && !excelData) ||
                loadingPreview
              }
            >
              <span>Tiếp theo</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleLaunchJob}
              disabled={submittingJob}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Play size={14} />
              <span>{submittingJob ? 'Đang khởi chạy...' : 'Bắt đầu gửi Form'}</span>
            </button>
          )}
        </div>
      </div>

      {/* STEP 1: Google Form */}
      {currentStep === 1 && (
        <div className="glass-panel glass-panel-glow" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={20} style={{ color: 'var(--primary)' }} />
            Bước 1: Khảo sát & Phân tích Google Form
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Hệ thống sẽ tự động quét mã nguồn Form để trích xuất các mã <code className="mono">entry.&lt;id&gt;</code>, phân loại câu hỏi (Trắc nghiệm, Đoạn văn, Hộp kiểm...) và số trang.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Nhập link Google Form (https://docs.google.com/forms/d/e/.../viewform)"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={() => handleInspectForm()}
              disabled={inspecting || !formUrl.trim()}
            >
              <Search size={16} />
              {inspecting ? 'Đang phân tích...' : 'Phân tích Form'}
            </button>
          </div>

          {formData && (
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginTop: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', color: '#fff' }}>{formData.title || 'Google Form'}</h4>
                  {formData.description && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                      {formData.description}
                    </p>
                  )}
                </div>
                <span className="badge badge-success">✓ Sẵn sàng</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Số Entry/Câu hỏi</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {formData.entry_count}
                  </div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Số trang</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-purple)' }}>
                    {formData.page_count}
                  </div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Default Page History</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-amber)' }} className="mono">
                    {formData.default_page_history}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowFormEntries(!showFormEntries)}
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  {showFormEntries ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{showFormEntries ? 'Ẩn chi tiết câu hỏi' : `Xem chi tiết ${formData.entries.length} câu hỏi`}</span>
                </button>

                {showFormEntries && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {formData.entries.map((entry, idx) => (
                      <div
                        key={entry.entry_id}
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>#{idx + 1}</span>
                          <span style={{ color: '#fff' }}>{entry.question_title}</span>
                          <QuestionTypeBadge typeName={entry.type_name} />
                          {entry.required && <span style={{ color: '#fda4af' }}>*</span>}
                        </div>
                        <span className="mono" style={{ color: 'var(--accent-cyan)' }}>
                          {entry.entry_id}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Nạp Excel */}
      {currentStep === 2 && (
        <div className="glass-panel glass-panel-glow" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--accent-emerald)' }} />
            Bước 2: Tải lên File Excel & Chọn Sheet dữ liệu
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Hệ thống hỗ trợ file <code className="mono">.xlsx</code> hoặc <code className="mono">.xlsm</code>. Bạn có thể chọn sheet mong muốn và điều chỉnh dòng tiêu đề.
          </p>

          <div
            className={`dropzone ${isDragOver ? 'active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ marginBottom: '1.25rem' }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLoadExcel(file);
              }}
              accept=".xlsx,.xlsm"
              style={{ display: 'none' }}
            />
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              {excelFile ? <FileCheck size={26} /> : <Upload size={24} />}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>
                {excelFile ? excelFile.name : 'Nhấn để chọn hoặc kéo thả file Excel vào đây'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Hỗ trợ định dạng .xlsx, .xlsm
              </div>
            </div>
          </div>

          {excelData && (
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  marginBottom: '1rem',
                }}
              >
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Chọn Sheet dữ liệu</label>
                  <select
                    className="form-select"
                    value={sheetName}
                    onChange={(e) => handleLoadExcel(excelFile, e.target.value, headerRow)}
                  >
                    {excelData.sheet_names?.map((name) => (
                      <option key={name} value={name}>
                        {name} {name === 'Coded' ? '(Khuyến nghị)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <span>Dòng tiêu đề (Header row)</span>
                    <span className="helper">Dòng chứa tên cột</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={headerRow}
                    onChange={(e) => {
                      const h = Number(e.target.value) || 1;
                      setHeaderRow(h);
                      handleLoadExcel(excelFile, sheetName, h);
                    }}
                  />
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Tìm thấy: <strong style={{ color: '#fff' }}>{excelData.row_count}</strong> dòng dữ liệu,{' '}
                <strong style={{ color: '#fff' }}>{excelData.column_count}</strong> cột trong sheet{' '}
                <span style={{ color: 'var(--accent-emerald)' }}>"{excelData.sheet_name}"</span>
              </div>

              <div className="table-container" style={{ maxHeight: '200px' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}>#</th>
                      {excelData.header.map((col, idx) => (
                        <th key={idx}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelData.sample_rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ color: 'var(--text-dim)' }}>{headerRow + rIdx + 1}</td>
                        {row.map((val, cIdx) => (
                          <td key={cIdx} className="mono" style={{ fontSize: '0.75rem' }}>
                            {val === null ? <span style={{ color: 'var(--text-dim)' }}>-</span> : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Timing & Options */}
      {currentStep === 3 && (
        <div className="glass-panel glass-panel-glow" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={20} style={{ color: 'var(--accent-purple)' }} />
                Bước 3: Cấu hình Timing & Quy tắc Gửi
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                Tùy chỉnh 3 dải thời gian ngẫu nhiên để chống chặn tự động và chọn phương thức ánh xạ dữ liệu.
              </p>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={loadDefaults}>
              <RefreshCw size={13} />
              Khôi phục Mặc định
            </button>
          </div>

          {/* 3 Timing Blocks */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '14px',
              marginBottom: '1.5rem',
            }}
          >
            {/* 1. Delay between forms */}
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#a5b4fc', marginBottom: '4px' }}>
                1. Nghỉ giữa 2 Form liên tiếp (giây)
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                DELAY_BETWEEN_FORMS: Khoảng nghỉ ngẫu nhiên trong cùng một đợt
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Min (giây)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="form-input"
                    value={timing.delay_min}
                    onChange={(e) => setTiming({ ...timing, delay_min: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <span style={{ color: 'var(--text-dim)', marginTop: '16px' }}>-</span>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Max (giây)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="form-input"
                    value={timing.delay_max}
                    onChange={(e) => setTiming({ ...timing, delay_max: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* 2. Batch size range */}
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#67e8f9', marginBottom: '4px' }}>
                2. Số lượng Form mỗi đợt (Batch size)
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                BATCH_SIZE_RANGE: Số form ngẫu nhiên gửi trước khi tạm nghỉ
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Min (form)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={timing.batch_min}
                    onChange={(e) => setTiming({ ...timing, batch_min: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <span style={{ color: 'var(--text-dim)', marginTop: '16px' }}>-</span>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Max (form)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={timing.batch_max}
                    onChange={(e) => setTiming({ ...timing, batch_max: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
              </div>
            </div>

            {/* 3. Pause between batches */}
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fcd34d', marginBottom: '4px' }}>
                3. Thời gian nghỉ giữa các đợt (giây)
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                PAUSE_BETWEEN_BATCHES: Nghỉ ngơi giữa các đợt gửi
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Min (giây)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="form-input"
                    value={timing.pause_min}
                    onChange={(e) => setTiming({ ...timing, pause_min: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <span style={{ color: 'var(--text-dim)', marginTop: '16px' }}>-</span>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Max (giây)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="form-input"
                    value={timing.pause_max}
                    onChange={(e) => setTiming({ ...timing, pause_max: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Options Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                <span>Chế độ Ánh xạ Cột (Mapping Mode)</span>
              </label>
              <select
                className="form-select"
                value={mappingMode}
                onChange={(e) => setMappingMode(e.target.value)}
              >
                <option value="position">Theo thứ tự vị trí (Cột i → Entry i)</option>
                <option value="header">Theo tên tiêu đề (entry.&lt;id&gt; hoặc tên câu hỏi)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                <span>Trang Form (pageHistory)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="auto | none | 0,1,2"
                value={pageHistory}
                onChange={(e) => setPageHistory(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                <span>Ký tự tách Checkbox</span>
                <span className="helper">Mặc định: ;</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={checkboxDelimiter}
                onChange={(e) => setCheckboxDelimiter(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                <span>Dòng bắt đầu (Start Row)</span>
              </label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={startRow}
                onChange={(e) => setStartRow(parseInt(e.target.value, 10) || 1)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                <span>Giới hạn số dòng (Max Rows)</span>
                <span className="helper">Bỏ trống = gửi hết</span>
              </label>
              <input
                type="number"
                min="1"
                className="form-input"
                placeholder="Gửi toàn bộ"
                value={maxRows}
                onChange={(e) => setMaxRows(e.target.value)}
              />
            </div>
          </div>

          {/* Flags Toggles */}
          <div
            style={{
              display: 'flex',
              gap: '1.5rem',
              flexWrap: 'wrap',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#fff' }}>Chạy thử nghiệm (DRY RUN)</strong>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                  Chỉ mô phỏng tạo payload và kiểm tra lỗi, KHÔNG gửi dữ liệu lên Google
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={stopOnError}
                onChange={(e) => setStopOnError(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#fff' }}>Dừng khi có lỗi (Stop on Error)</strong>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                  Ngắt job ngay lập tức khi phát hiện một dòng dữ liệu gửi thất bại
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* STEP 4: Xem trước & Khởi chạy */}
      {currentStep === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Mapping & Payloads Preview */}
          <div className="glass-panel glass-panel-glow" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={20} style={{ color: 'var(--accent-cyan)' }} />
                  Bước 4: Xem trước Bảng Ánh xạ (Mapping) & Payloads Mẫu
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                  Kiểm tra xem từng cột trong Excel sẽ được gán vào câu hỏi nào của Google Form trước khi bấm gửi.
                </p>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleGeneratePreview}
                disabled={loadingPreview}
              >
                <RefreshCw size={13} className={loadingPreview ? 'spin' : ''} />
                Tải lại mô phỏng
              </button>
            </div>

            {loadingPreview ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Đang tạo mô phỏng dữ liệu...
              </div>
            ) : jobPreview ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Warnings Banner */}
                {jobPreview.warnings && jobPreview.warnings.length > 0 && (
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fcd34d', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      <AlertTriangle size={16} />
                      <span>Cảnh báo ánh xạ cột ({jobPreview.warnings.length})</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#fde68a', fontSize: '0.775rem' }}>
                      {jobPreview.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mapping Table */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '8px' }}>
                    Bảng Ánh xạ Cột Excel → Google Form Entry
                  </h4>
                  <div className="table-container" style={{ maxHeight: '280px' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>Cột #</th>
                          <th>Tên Tiêu đề Excel</th>
                          <th>Mã Entry Google Form</th>
                          <th>Loại Ánh xạ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobPreview.mapping?.map((m, idx) => (
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
                </div>

                {/* Payloads Preview */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '8px' }}>
                    Dữ liệu Payload mẫu ({jobPreview.payloads?.length || 0} dòng đầu)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {jobPreview.payloads?.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 14px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span className="badge badge-primary">Dòng Excel: {p.row}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            {Object.keys(p.payload).length} trường
                          </span>
                        </div>
                        <pre
                          className="mono"
                          style={{
                            fontSize: '0.75rem',
                            color: '#cbd5e1',
                            margin: 0,
                            overflowX: 'auto',
                          }}
                        >
                          {JSON.stringify(p.payload, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Action Card */}
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            <div>
              <h4 style={{ fontSize: '1.1rem', color: '#fff' }}>Sẵn sàng khởi chạy quy trình tự động!</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                Job sẽ chạy ngầm trên máy chủ. Bạn có thể theo dõi tiến độ, xem logs và huỷ bất kỳ lúc nào.
              </p>
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={handleLaunchJob}
              disabled={submittingJob}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Play size={18} />
              <span>{submittingJob ? 'Đang tạo Job...' : 'Xác nhận & Bắt đầu gửi'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
