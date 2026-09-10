/**
 * API client module for Auto Fill Google Forms Backend.
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';

export function getApiBaseUrl() {
  return localStorage.getItem('autofill_api_url') || DEFAULT_BASE_URL;
}

export function setApiBaseUrl(url) {
  const clean = (url || '').trim().replace(/\/+$/, '');
  localStorage.setItem('autofill_api_url', clean || DEFAULT_BASE_URL);
  return clean || DEFAULT_BASE_URL;
}

async function request(path, options = {}, customBaseUrl = null) {
  const baseUrl = (customBaseUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = { ...options.headers };
  // Do not set Content-Type if sending FormData, browser will set boundary automatically
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 204) {
      return null;
    }

    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      let errorMessage = `Yêu cầu thất bại (HTTP ${res.status})`;
      if (data && typeof data === 'object') {
        if (data.detail) {
          if (Array.isArray(data.detail)) {
            errorMessage = data.detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
          } else {
            errorMessage = String(data.detail);
          }
        } else if (data.message) {
          errorMessage = data.message;
        }
      } else if (typeof data === 'string' && data.length > 0) {
        errorMessage = data;
      }
      const err = new Error(errorMessage);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    if (error.status) throw error;
    // Network or connection refusal errors
    const netErr = new Error(`Không thể kết nối tới máy chủ (${url}). Vui lòng đảm bảo Backend đã được khởi chạy.`);
    netErr.originalError = error;
    throw netErr;
  }
}

export const api = {
  // 1. Meta / Health
  async health(customBaseUrl = null) {
    return request('/health', { method: 'GET' }, customBaseUrl);
  },

  async getDefaults(customBaseUrl = null) {
    return request('/config/defaults', { method: 'GET' }, customBaseUrl);
  },

  // 2. Google Form
  async normalizeUrls(formUrl, customBaseUrl = null) {
    const encoded = encodeURIComponent(formUrl);
    return request(`/form/urls?form_url=${encoded}`, { method: 'GET' }, customBaseUrl);
  },

  async inspectForm(formUrl, customBaseUrl = null) {
    return request(
      '/form/inspect',
      {
        method: 'POST',
        body: JSON.stringify({ form_url: formUrl }),
      },
      customBaseUrl
    );
  },

  // 3. Excel
  async previewExcel({ file, sheetName = null, headerRow = 1, limit = 5 }, customBaseUrl = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) formData.append('sheet_name', sheetName);
    formData.append('header_row', String(headerRow));
    formData.append('limit', String(limit));

    return request('/excel/preview', { method: 'POST', body: formData }, customBaseUrl);
  },

  // 4. Jobs
  async previewJob(params, customBaseUrl = null) {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('form_url', params.form_url);
    if (params.sheet_name) formData.append('sheet_name', params.sheet_name);
    formData.append('header_row', String(params.header_row || 1));
    formData.append('mapping_mode', params.mapping_mode || 'position');
    if (params.entry_list) formData.append('entry_list', params.entry_list);
    formData.append('page_history', params.page_history || 'auto');
    formData.append('checkbox_delimiter', params.checkbox_delimiter || ';');
    formData.append('start_row', String(params.start_row || 1));
    formData.append('limit', String(params.limit || 3));

    return request('/jobs/preview', { method: 'POST', body: formData }, customBaseUrl);
  },

  async createJob(params, customBaseUrl = null) {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('form_url', params.form_url);
    if (params.sheet_name) formData.append('sheet_name', params.sheet_name);
    formData.append('header_row', String(params.header_row || 1));

    if (params.delay_min !== undefined && params.delay_min !== null && params.delay_min !== '') {
      formData.append('delay_min', String(params.delay_min));
    }
    if (params.delay_max !== undefined && params.delay_max !== null && params.delay_max !== '') {
      formData.append('delay_max', String(params.delay_max));
    }
    if (params.batch_min !== undefined && params.batch_min !== null && params.batch_min !== '') {
      formData.append('batch_min', String(params.batch_min));
    }
    if (params.batch_max !== undefined && params.batch_max !== null && params.batch_max !== '') {
      formData.append('batch_max', String(params.batch_max));
    }
    if (params.pause_min !== undefined && params.pause_min !== null && params.pause_min !== '') {
      formData.append('pause_min', String(params.pause_min));
    }
    if (params.pause_max !== undefined && params.pause_max !== null && params.pause_max !== '') {
      formData.append('pause_max', String(params.pause_max));
    }

    formData.append('mapping_mode', params.mapping_mode || 'position');
    if (params.entry_list) formData.append('entry_list', params.entry_list);
    formData.append('page_history', params.page_history || 'auto');
    formData.append('checkbox_delimiter', params.checkbox_delimiter || ';');
    formData.append('start_row', String(params.start_row || 1));
    if (params.max_rows) formData.append('max_rows', String(params.max_rows));
    formData.append('dry_run', params.dry_run ? 'true' : 'false');
    formData.append('stop_on_error', params.stop_on_error ? 'true' : 'false');

    return request('/jobs', { method: 'POST', body: formData }, customBaseUrl);
  },

  async listJobs(customBaseUrl = null) {
    return request('/jobs', { method: 'GET' }, customBaseUrl);
  },

  async getJob(jobId, customBaseUrl = null) {
    return request(`/jobs/${jobId}`, { method: 'GET' }, customBaseUrl);
  },

  async getJobPayloads(jobId, limit = 20, customBaseUrl = null) {
    return request(`/jobs/${jobId}/payloads?limit=${limit}`, { method: 'GET' }, customBaseUrl);
  },

  async pauseJob(jobId, customBaseUrl = null) {
    return request(`/jobs/${jobId}/pause`, { method: 'POST' }, customBaseUrl);
  },

  async resumeJob(jobId, customBaseUrl = null) {
    return request(`/jobs/${jobId}/resume`, { method: 'POST' }, customBaseUrl);
  },

  async cancelJob(jobId, customBaseUrl = null) {
    return request(`/jobs/${jobId}/cancel`, { method: 'POST' }, customBaseUrl);
  },

  async deleteJob(jobId, customBaseUrl = null) {
    return request(`/jobs/${jobId}`, { method: 'DELETE' }, customBaseUrl);
  },
};
