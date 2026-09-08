import React from 'react';
import { PlayCircle, CheckCircle2, XCircle, AlertOctagon, Clock, HelpCircle, FileText, CheckSquare, List, Calendar, ArrowRightLeft } from 'lucide-react';

export function JobStatusBadge({ status }) {
  switch (status) {
    case 'running':
      return (
        <span className="badge badge-primary">
          <span className="pulse-dot pulse-running" />
          Đang chạy
        </span>
      );
    case 'completed':
      return (
        <span className="badge badge-success">
          <CheckCircle2 size={13} />
          Hoàn thành
        </span>
      );
    case 'failed':
      return (
        <span className="badge badge-danger">
          <XCircle size={13} />
          Thất bại
        </span>
      );
    case 'cancelled':
      return (
        <span className="badge badge-warning">
          <AlertOctagon size={13} />
          Đã huỷ
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="badge badge-secondary">
          <Clock size={13} />
          Chờ xử lý
        </span>
      );
  }
}

export function QuestionTypeBadge({ typeName }) {
  const format = {
    short_answer: { label: 'Câu trả lời ngắn', icon: <FileText size={12} />, bg: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd' },
    paragraph: { label: 'Đoạn văn', icon: <FileText size={12} />, bg: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd' },
    multiple_choice: { label: 'Trắc nghiệm', icon: <CheckCircle2 size={12} />, bg: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe' },
    checkboxes: { label: 'Hộp kiểm', icon: <CheckSquare size={12} />, bg: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7' },
    dropdown: { label: 'Menu thả xuống', icon: <List size={12} />, bg: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d' },
    linear_scale: { label: 'Thang đo tuyến tính', icon: <List size={12} />, bg: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' },
    grid: { label: 'Lưới trắc nghiệm', icon: <List size={12} />, bg: 'rgba(14, 165, 233, 0.15)', color: '#7dd3fc' },
    date: { label: 'Ngày', icon: <Calendar size={12} />, bg: 'rgba(20, 184, 166, 0.15)', color: '#5eead4' },
    time: { label: 'Giờ', icon: <Clock size={12} />, bg: 'rgba(20, 184, 166, 0.15)', color: '#5eead4' },
  };

  const item = format[typeName] || { label: typeName || 'Khác', icon: <HelpCircle size={12} />, bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '999px',
        fontSize: '0.725rem',
        fontWeight: 500,
        backgroundColor: item.bg,
        color: item.color,
      }}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

export function MappingKindBadge({ kind }) {
  const styles = {
    position: { bg: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', text: 'Vị trí (Thứ tự)' },
    title: { bg: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', text: 'Tiêu đề câu hỏi' },
    entry_id: { bg: 'rgba(6, 182, 212, 0.15)', color: '#67e8f9', text: 'Mã Entry' },
    special: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', text: 'Cột đặc biệt' },
  };

  const current = styles[kind] || { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', text: kind };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '0.7rem',
        fontWeight: 600,
        backgroundColor: current.bg,
        color: current.color,
      }}
    >
      <ArrowRightLeft size={11} />
      {current.text}
    </span>
  );
}
