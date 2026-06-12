import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally (token expired/invalid) and normalize error responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // Normalize server error messages (ZodError/AppError) into error.response.data.error
    if (error.response?.data) {
      const data = error.response.data;
      if (!data.error) {
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          data.error = data.errors.map((e: any) => e.field ? `${e.field}: ${e.message}` : e.message).join(', ');
        } else if (data.message) {
          data.error = data.message;
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export const getFileUrl = (filePath: string) => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const normalized = filePath.replace(/\\/g, '/');
  return `/${normalized}`;
};

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  me: () => api.get('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),

  logout: () => api.post('/auth/logout'),
};

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: Record<string, string>) =>
    api.get('/users', { params }),

  getById: (id: string) => api.get(`/users/${id}`),

  create: (data: any) => api.post('/users', data),

  update: (id: string, data: any) => api.put(`/users/${id}`, data),

  delete: (id: string) => api.delete(`/users/${id}`),
};

// ─── Departments API ──────────────────────────────────────────────────────────

export const departmentsApi = {
  list: () => api.get('/departments'),

  getById: (id: string) => api.get(`/departments/${id}`),
};

// ─── Applications API ─────────────────────────────────────────────────────────

export const applicationsApi = {
  list: (params?: Record<string, string>) =>
    api.get('/applications', { params }),

  get: (id: string) => api.get(`/applications/${id}`),

  getById: (id: string) => api.get(`/applications/${id}`),

  create: (academic_year: string) =>
    api.post('/applications', { academic_year }),

  saveEntry: (appId: string, category_id: string, raw_value: Record<string, any>) =>
    api.put(`/applications/${appId}/entry`, { category_id, raw_value }),

  uploadProof: (appId: string, categoryId: string, file: File, itemIndex?: number) => {
    const fd = new FormData();
    fd.append('file', file);
    const url = itemIndex !== undefined 
      ? `/applications/${appId}/upload/${categoryId}?item_index=${itemIndex}`
      : `/applications/${appId}/upload/${categoryId}`;
    return api.post(url, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteProof: (appId: string, docId: string) =>
    api.delete(`/applications/${appId}/proof/${docId}`),

  submit: (appId: string) =>
    api.post(`/applications/${appId}/submit`),

  scorePreview: (appId: string) =>
    api.get(`/applications/${appId}/score-preview`),

  categories: () =>
    api.get('/applications/categories/list'),

  review: (appId: string, data: { action: string; comments?: string; role?: string }) =>
    api.post(`/reviews/${appId}`, { decision: data.action === 'approve' ? 'APPROVED' : 'REJECTED', comments: data.comments }),
};

// ─── Reviews API ──────────────────────────────────────────────────────────────

export const reviewsApi = {
  submit: (appId: string, decision: string, comments: string, reviewer_score?: number | '', signature_path?: string) =>
    api.post(`/reviews/${appId}`, { decision, comments, signature_path, reviewer_score: reviewer_score !== '' && reviewer_score !== undefined ? Number(reviewer_score) : undefined }),

  uploadSignature: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/reviews/upload-signature', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  updateEntryScore: (appId: string, categoryId: string, reviewer_score: number | '') =>
    api.put(`/reviews/${appId}/entry/${categoryId}/score`, { reviewer_score }),
};

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  stats: () => api.get('/admin/stats'),

  approvalsRejections: () => api.get('/admin/approvals-rejections'),

  scoringCategories: () => api.get('/admin/scoring-categories'),

  updateScoringCategory: (id: string, data: any) => 
    api.put(`/admin/scoring-categories/${id}`, data),

  auditLogs: (params?: Record<string, string>) =>
    api.get('/admin/audit-logs', { params }),

  overrideApplication: (facultyId: string, action: 'EDIT' | 'OPEN') =>
    api.post(`/admin/override-application/${facultyId}`, { action }),

  assignReviewer: (appId: string, reviewerId: string) =>
    api.post('/admin/assign-reviewer', { application_id: appId, reviewer_id: reviewerId }),

  forwardToPrincipal: (appId: string) =>
    api.post('/admin/forward-to-principal', { application_ids: [appId] }),

  freezeApplication: (appId: string) =>
    api.post('/admin/freeze', { application_ids: [appId] }),

  sendToAccounts: (appId: string) =>
    api.post('/admin/send-to-accounts', { application_ids: [appId] }),
};

// ─── Reports API ──────────────────────────────────────────────────────────────

export const reportsApi = {
  downloadAppraisalPDF: (appId: string) =>
    api.get(`/reports/appraisal/${appId}/pdf`, { responseType: 'blob' }),

  downloadConsolidatedPDF: (params?: Record<string, string>) =>
    api.get('/reports/consolidated/pdf', { params, responseType: 'blob' }),

  downloadExcel: (params?: Record<string, string>) =>
    api.get('/reports/consolidated/excel', { params, responseType: 'blob' }),
};
