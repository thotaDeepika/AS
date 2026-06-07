import { useEffect, useState } from 'react';
import { applicationsApi, reportsApi } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

interface Application {
  id: string;
  academic_year: string;
  status: string;
  total_score: number | null;
  reviewer_score?: number | null;
  faculty: {
    id: string;
    name: string;
    email: string;
    department: { name: string; code: string };
    designation: string | null;
  };
  entries?: any[];
  reviews?: any[];
}

export default function PrincipalDashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => { loadApplications(); }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await applicationsApi.list();
      // Principal sees apps that have been reviewer-reviewed or already principal-reviewed
      const apps = (res.data.data.applications || []).filter((a: Application) =>
        ['REVIEWER_REVIEWED', 'PRINCIPAL_REVIEWED', 'FROZEN', 'SENT_TO_ACCOUNTS'].includes(a.status)
      );
      setApplications(apps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const viewDetail = async (app: Application) => {
    setDetailLoading(true);
    setSelectedApp(app);
    try {
      const res = await applicationsApi.get(app.id);
      setSelectedApp(res.data.data.application);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedApp) return;
    setSubmitting(true);
    try {
      await applicationsApi.review(selectedApp.id, {
        action,
        comments: comment,
        role: 'PRINCIPAL',
      });
      showToast('success', `Application ${action === 'approve' ? 'approved' : 'returned'} successfully`);
      setSelectedApp(null);
      setComment('');
      loadApplications();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Review failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = async (appId: string, year: string) => {
    try {
      showToast('success', 'Generating PDF...');
      const res = await reportsApi.downloadAppraisalPDF(appId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `appraisal_${year}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e) {
      console.error('PDF download failed', e);
      showToast('error', 'Failed to download PDF report');
    }
  };

  const filtered = filterStatus === 'ALL' ? applications : applications.filter(a => a.status === filterStatus);

  // Stats
  const pending = applications.filter(a => a.status === 'REVIEWER_REVIEWED').length;
  const approved = applications.filter(a => ['PRINCIPAL_REVIEWED', 'FROZEN', 'SENT_TO_ACCOUNTS'].includes(a.status)).length;
  const avgScore = applications.length > 0
    ? (applications.reduce((sum, a) => sum + (a.total_score ? Number(a.total_score) : 0), 0) / applications.length).toFixed(1)
    : '0.0';

  const columns = [
    {
      key: 'faculty',
      header: 'Faculty',
      render: (row: Application) => (
        <div className="cell-faculty">
          <span className="cell-name">{row.faculty.name}</span>
          <span className="cell-sub">{row.faculty.department.code} • {(row.faculty.designation || 'N/A').replace(/_/g, ' ')}</span>
        </div>
      ),
    },
    { key: 'academic_year', header: 'Year', sortable: true },
    {
      key: 'status',
      header: 'Status',
      render: (row: Application) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'total_score',
      header: 'Score',
      sortable: true,
      render: (row: Application) => (
        <span className="cell-score">
          {row.reviewer_score !== null && row.reviewer_score !== undefined
            ? <><span style={{ color: '#f59e0b', fontWeight: 'bold' }} title="Reviewer Score">{Number(row.reviewer_score).toFixed(1)}</span> <span style={{ textDecoration: 'line-through', fontSize: '0.8em', color: '#94a3b8' }} title="Original Score">{row.total_score != null ? Number(row.total_score).toFixed(1) : ''}</span></>
            : (row.total_score != null ? Number(row.total_score).toFixed(1) : '—')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row: Application) => (
        <div className="cell-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            className="btn-download-pdf"
            onClick={() => handleDownloadPDF(row.id, row.academic_year)}
            title="Download Full Report PDF"
          >
            <span className="download-icon">📥</span> PDF
          </button>
          <button className="btn-small btn-accent" onClick={() => viewDetail(row)}>
            🔍 Review
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="principal-page">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</div>}

      <div className="page-title">
        <div>
          <h2>Principal Review Dashboard</h2>
          <p>Final review and approval of faculty appraisals</p>
        </div>
      </div>

      {/* Stats */}
      <div className="principal-stats">
        <div className="principal-stat">
          <span className="principal-stat-value pending">{pending}</span>
          <span className="principal-stat-label">Pending Review</span>
        </div>
        <div className="principal-stat">
          <span className="principal-stat-value approved">{approved}</span>
          <span className="principal-stat-label">Approved</span>
        </div>
        <div className="principal-stat">
          <span className="principal-stat-value total">{applications.length}</span>
          <span className="principal-stat-label">Total</span>
        </div>
        <div className="principal-stat">
          <span className="principal-stat-value avg">{avgScore}</span>
          <span className="principal-stat-label">Avg Score</span>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">All Statuses</option>
          <option value="REVIEWER_REVIEWED">Awaiting Review</option>
          <option value="PRINCIPAL_REVIEWED">Approved</option>
          <option value="FROZEN">Frozen</option>
          <option value="SENT_TO_ACCOUNTS">Sent to Accounts</option>
        </select>
        <span className="filter-count">{filtered.length} applications</span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchable
        searchPlaceholder="Search by faculty name..."
        loading={loading}
        emptyMessage="No applications awaiting principal review"
        pagination={{ page: 1, pages: 1, total: filtered.length, onPageChange: () => {} }}
      />

      {/* Detail Modal */}
      {selectedApp && (
        <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Review: {selectedApp.faculty.name}</h3>
              <button className="modal-close" onClick={() => setSelectedApp(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              {detailLoading ? (
                <div className="page-loader-inline"><div className="loader-spinner" /><p>Loading details...</p></div>
              ) : (
                <>
                  <div className="principal-detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Department</span>
                      <span className="detail-value">{selectedApp.faculty.department.name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Designation</span>
                      <span className="detail-value">{(selectedApp.faculty.designation || 'N/A').replace(/_/g, ' ')}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Academic Year</span>
                      <span className="detail-value">{selectedApp.academic_year}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">System Score</span>
                      <span className="detail-value score">{selectedApp.total_score != null ? Number(selectedApp.total_score).toFixed(1) : '—'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Reviewer Score</span>
                      <span className="detail-value score">{selectedApp.reviewer_score != null ? Number(selectedApp.reviewer_score).toFixed(1) : '—'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Status</span>
                      <StatusBadge status={selectedApp.status} />
                    </div>
                  </div>

                  {/* Reviews history */}
                  {selectedApp.reviews && selectedApp.reviews.length > 0 && (
                    <div className="detail-section">
                      <h5>Review History</h5>
                      <div className="review-history">
                        {selectedApp.reviews.map((r: any, i: number) => (
                          <div key={i} className="review-entry">
                            <div className="review-entry-header">
                              <span className="review-entry-role">{(r.role_at_review || r.reviewer?.role || 'Reviewer').replace('_', ' ')}</span>
                              <StatusBadge status={r.decision} size="sm" />
                            </div>
                            {r.comments && <p className="review-entry-comment">"{r.comments}"</p>}
                            <span className="review-entry-date">{new Date(r.reviewed_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Principal review form */}
                  {selectedApp.status === 'REVIEWER_REVIEWED' && (
                    <div className="detail-section">
                      <h5>Your Review</h5>
                      <div className="form-group">
                        <label>Comments</label>
                        <textarea
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                          placeholder="Add your review comments..."
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {selectedApp.status === 'REVIEWER_REVIEWED' && (
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setSelectedApp(null)}>Cancel</button>
                <button
                  className="btn-small btn-danger"
                  onClick={() => handleReview('reject')}
                  disabled={submitting}
                  style={{ padding: '10px 20px', fontSize: '14px' }}
                >
                  {submitting ? '...' : '✕ Return'}
                </button>
                <button
                  className="btn-primary"
                  onClick={() => handleReview('approve')}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : '✓ Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
