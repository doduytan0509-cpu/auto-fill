import React, { useState, useRef } from 'react';
import { FileSpreadsheet, Upload, RefreshCw, ArrowRight, Table, Layers, AlertCircle, FileCheck } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

export function ExcelViewerView({ onUseExcelInStudio }) {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [excelData, setExcelData] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const loadPreview = async (targetFile, targetSheet = sheetName, targetHeader = headerRow, targetLimit = limit) => {
    if (!targetFile) return;
    setLoading(true);
    try {
      const data = await api.previewExcel({
        file: targetFile,
        sheetName: targetSheet || null,
        headerRow: Number(targetHeader) || 1,
        limit: Number(targetLimit) || 10,
      });
      setExcelData(data);
      setSheetName(data.sheet_name);
      toast.success(`Đã nạp sheet "${data.sheet_name}" (${data.row_count} dòng, ${data.column_count} cột)`);
    } catch (err) {
      toast.error(err.message || 'Lỗi đọc file Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.match(/\.(xlsx|xlsm)$/i)) {
      toast.error('Vui lòng chọn file Excel có định dạng .xlsx hoặc .xlsm');
      return;
    }
    setFile(selected);
    loadPreview(selected, '', headerRow, limit);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (!dropped.name.match(/\.(xlsx|xlsm)$/i)) {
      toast.error('Vui lòng chọn file Excel có định dạng .xlsx hoặc .xlsm');
      return;
    }
    setFile(dropped);
    loadPreview(dropped, '', headerRow, limit);
  };

  const handleSheetChange = (e) => {
    const newSheet = e.target.value;
    setSheetName(newSheet);
    loadPreview(file, newSheet, headerRow, limit);
  };

  const handleHeaderRowChange = (e) => {
    const newHeader = parseInt(e.target.value, 10) || 1;
    setHeaderRow(newHeader);
    loadPreview(file, sheetName, newHeader, limit);
  };

  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value, 10) || 10;
    setLimit(newLimit);
    loadPreview(file, sheetName, headerRow, newLimit);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Upload & Controls Card */}
      <div className="glass-panel glass-panel-glow" style={{ padding: '1.75rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet style={{ color: 'var(--accent-emerald)' }} size={24} />
            Công cụ Kiểm tra File Excel (Excel Viewer)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
            Tải lên file Excel để xem danh sách Sheet, tùy chỉnh dòng tiêu đề và kiểm tra bảng dữ liệu đã được chuẩn hoá trước khi gửi form.
          </p>
        </div>

        {/* Dropzone */}
        <div
          className={`dropzone ${isDragOver ? 'active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ marginBottom: '1.25rem' }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
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
            {file ? <FileCheck size={26} /> : <Upload size={24} />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>
              {file ? file.name : 'Nhấn để chọn hoặc kéo thả file Excel vào đây'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Hỗ trợ định dạng .xlsx, .xlsm (Mặc định tự động chọn sheet "Coded" nếu có)
            </div>
          </div>
        </div>

        {/* Configurations when file loaded */}
        {file && excelData && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Chọn Sheet</label>
              <select className="form-select" value={sheetName} onChange={handleSheetChange}>
                {excelData.sheet_names?.map((name) => (
                  <option key={name} value={name}>
                    {name} {name === 'Coded' ? '(Khuyến nghị)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                <span>Dòng tiêu đề (Header Row)</span>
                <span className="helper">Dòng chứa tên cột</span>
              </label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={headerRow}
                onChange={handleHeaderRowChange}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Số dòng mẫu hiển thị</label>
              <select className="form-select" value={limit} onChange={handleLimitChange}>
                <option value="5">5 dòng đầu</option>
                <option value="10">10 dòng đầu</option>
                <option value="20">20 dòng đầu</option>
                <option value="50">50 dòng đầu</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => loadPreview(file, sheetName, headerRow, limit)}
                disabled={loading}
                style={{ flex: 1 }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                Làm mới
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {excelData && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Table size={18} style={{ color: 'var(--accent-emerald)' }} />
                Dữ liệu mẫu từ Sheet: <span style={{ color: 'var(--accent-emerald)' }}>{excelData.sheet_name}</span>
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Tổng cộng: <strong style={{ color: '#fff' }}>{excelData.row_count}</strong> dòng dữ liệu,{' '}
                <strong style={{ color: '#fff' }}>{excelData.column_count}</strong> cột
              </div>
            </div>

            {onUseExcelInStudio && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onUseExcelInStudio(file, excelData)}
                style={{ gap: '6px' }}
              >
                <span>Dùng file Excel này trong Studio</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          <div className="table-container" style={{ maxHeight: '480px' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                  {excelData.header.map((colName, idx) => (
                    <th key={idx}>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Cột {idx + 1}</div>
                      <div style={{ color: '#fff', fontWeight: 600 }}>{colName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {excelData.sample_rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600 }}>
                      {headerRow + rIdx + 1}
                    </td>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx}>
                        {cell === null ? (
                          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                            (trống)
                          </span>
                        ) : (
                          <span className="mono" style={{ fontSize: '0.8rem' }}>
                            {String(cell)}
                          </span>
                        )}
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
  );
}
