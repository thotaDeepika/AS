import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { applicationsApi, reviewsApi } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ScoreCard from '../components/ScoreCard';

interface Application {
  id: string;
  academic_year: string;
  status: string;
  total_score: number | null;
  faculty: {
    id: string;
    name: string;
    email: string;
    designation: string;
    department: { name: string; code: string };
  };
  _count: { category_entries: number; reviews: number };
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [reviewing, setReviewing] = useState(false);
  const [decision, setDecision] = useState('RECOMMENDED');
  const [comments, setComments] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadApplications = async () => {
    try {
      const res = await applicationsApi.list();
      setApplications(res.data.data.applications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleViewDetail = async (app: Application) => {
    try {
      const res = await applicationsApi.getById(app.id);
      setSelectedApp(res.data.data.application);
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to load application');
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedApp) return;
    setReviewing(true);
    try {
      await reviewsApi.submit(selectedApp.id, decision, comments);
      showToast('success', 'Review submitted successfully');
      setSelectedApp(null);
      setDecision('RECOMMENDED');
      setComments('');
      loadApplications();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Review submission failed');
    } finally {
      setReviewing(false);
    }
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const columns = [
    {
      key: 'faculty',
      header: 'Faculty',
      render: (row: Application) => (
        <div className="cell-faculty">
          <span className="cell-name">{row.faculty.name}</span>
          <span className="cell-sub">{row.faculty.email}</span>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (row: Application) => row.faculty.department.code,
    },
    {
      key: 'academic_year',
      header: 'Year',
      sortable: true,
    },
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
        <span className="cell-score">{row.total_score != null ? Number(row.total_score).toFixed(1) : '—'}</span>
      ),
    },
    {
      key: 'entries',
      header: 'Entries',
      render: (row: Application) => row._count.category_entries,
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (row: Application) => (
        <button className="btn-small" onClick={() => handleViewDetail(row)}>
          View →
        </button>
      ),
    },
  ];

  // Application detail modal
  if (selectedApp) {
    return (
      <div className="review-detail-page">
        {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</div>}

        <button className="btn-back" onClick={() => setSelectedApp(null)}>← Back to List</button>

        <div className="review-detail-header">
          <div>
            <h2>{selectedApp.faculty.name}</h2>
            <p>{selectedApp.faculty.email} • {selectedApp.faculty.department?.name}</p>
            <p>Designation: {selectedApp.faculty.designation?.replace(/_/g, ' ')}</p>
          </div>
          <StatusBadge status={selectedApp.status} />
        </div>

        {/* Scores */}
        {selectedApp.total_score !== null && (
          <div className="score-overview">
            <ScoreCard label="Teaching" score={selectedApp.section_scores?.teaching ?? 0} maxScore={60} color="#3b82f6" size="sm" />
            <ScoreCard label="Research" score={selectedApp.section_scores?.research ?? 0} maxScore={30} color="#8b5cf6" size="sm" />
            <ScoreCard label="Service" score={selectedApp.section_scores?.service ?? 0} maxScore={30} color="#10b981" size="sm" />
            <ScoreCard label="Total" score={selectedApp.total_score ?? 0} maxScore={100} color="#f59e0b" />
          </div>
        )}

        {/* Category Entries */}
        <div className="review-entries">
          <h3>Category Entries ({selectedApp.category_entries?.length || 0})</h3>
          {selectedApp.category_entries?.map((entry: any) => (
            <div key={entry.id} className="review-entry-card">
              <div className="entry-header">
                <span className="entry-sl">{entry.category.sl_no}</span>
                <div className="entry-info">
                  <h4>{entry.category.name}</h4>
                  <span className="entry-section">{entry.category.section}</span>
                </div>
                <span className="entry-score">
                  {entry.calculated_score !== null ? Number(entry.calculated_score).toFixed(1) : '—'}
                </span>
              </div>
              <div className="entry-values">
                {Object.entries(entry.raw_value || {}).map(([key, val]) => (
                  <span key={key} className="entry-value-chip">
                    {key.replace(/_/g, ' ')}: <strong>{String(val)}</strong>
                  </span>
                ))}
              </div>
              {entry.proof_documents?.length > 0 && (
                <div className="entry-docs">
                  {entry.proof_documents.map((doc: any) => (
                    <span key={doc.id} className="doc-chip">📄 {doc.file_name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Previous Reviews */}
        {selectedApp.reviews?.length > 0 && (
          <div className="review-history">
            <h3>Previous Reviews</h3>
            {selectedApp.reviews.map((r: any) => (
              <div key={r.id} className="review-card">
                <div className="review-header">
                  <span className="review-role">{r.role_at_review}</span>
                  <span className="review-name">{r.reviewer?.name}</span>
                  <StatusBadge status={r.decision} size="sm" />
                </div>
                {r.comments && <p className="review-comments">{r.comments}</p>}
                <span className="review-date">{new Date(r.reviewed_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Review Form — only show if the user can review this application */}
        {canReview(user?.role || '', selectedApp.status) && (
          <div className="review-form-section">
            <h3>Submit Your Review</h3>
            <div className="review-form">
              <div className="form-group">
                <label>Decision</label>
                <select value={decision} onChange={e => setDecision(e.target.value)}>
                  <option value="RECOMMENDED">✅ Recommended</option>
                  <option value="NOT_RECOMMENDED">❌ Not Recommended</option>
                </select>
              </div>
              <div className="form-group">
                <label>Comments</label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Add your review comments..."
                  rows={4}
                />
              </div>
              <button className="btn-primary" onClick={handleSubmitReview} disabled={reviewing || !comments.trim()}>
                {reviewing ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="reviews-page">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</div>}
      <div className="page-title">
        <h2>{user?.role === 'HOD' ? 'Department Reviews' : user?.role === 'REVIEWER' ? 'Assigned Reviews' : 'Applications for Review'}</h2>
        <p>Review and provide your assessment for submitted applications</p>
      </div>
      <DataTable
        columns={columns}
        data={applications}
        searchable
        searchPlaceholder="Search by faculty name or email..."
        loading={loading}
        emptyMessage="No applications pending your review"
        pagination={{ page: 1, pages: 1, total: applications.length, onPageChange: () => {} }}
      />
    </div>
  );
}

function canReview(role: string, status: string): boolean {
  if (role === 'HOD' && status === 'SUBMITTED') return true;
  if (role === 'REVIEWER' && status === 'REVIEWER_ASSIGNED') return true;
  if (role === 'PRINCIPAL' && status === 'REVIEWER_REVIEWED') return true;
  return false;
}
