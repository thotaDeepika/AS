import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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

// Handle 401 globally (token expired/invalid)
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
    return Promise.reject(error);
  }
);

export default api;

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

  uploadProof: (appId: string, categoryId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/applications/${appId}/upload/${categoryId}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

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
  submit: (appId: string, decision: string, comments: string) =>
    api.post(`/reviews/${appId}`, { decision, comments }),
};

// ─── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
  stats: () => api.get('/admin/stats'),

  scoringCategories: () => api.get('/admin/scoring-categories'),

  auditLogs: (params?: Record<string, string>) =>
    api.get('/admin/audit-logs', { params }),

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
