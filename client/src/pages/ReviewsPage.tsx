import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { applicationsApi, reviewsApi, getFileUrl } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ScoreCard from '../components/ScoreCard';

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
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
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
      if (user?.role === 'PRINCIPAL') {
        setDecision('APPROVED');
      } else {
        setDecision('RECOMMENDED');
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to load application');
    }
  };

  const handleSubmitReview = async () => {
    if (!comments.trim()) return;
    setReviewing(true);
    try {
      let signaturePath = undefined;
      if (signatureFile) {
        const uploadRes = await reviewsApi.uploadSignature(signatureFile);
        signaturePath = uploadRes.data.data.file_path;
      }
      const res = await reviewsApi.submit(selectedApp.id, decision, comments, undefined, signaturePath);
      showToast('success', res.data.message);
      setComments('');
      setSignatureFile(null);
      // Reload application
      handleViewDetail(selectedApp);
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
        <span className="cell-score">
          {row.reviewer_score !== null && row.reviewer_score !== undefined
            ? <><span style={{ color: '#f59e0b', fontWeight: 'bold' }} title="Reviewer Score">{Number(row.reviewer_score).toFixed(1)}</span> <span style={{ textDecoration: 'line-through', fontSize: '0.8em', color: '#94a3b8' }} title="Original Score">{row.total_score != null ? Number(row.total_score).toFixed(1) : ''}</span></>
            : (row.total_score != null ? Number(row.total_score).toFixed(1) : '—')}
        </span>
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
        {(() => {
          let teaching = 0, research = 0, service = 0;
          selectedApp.category_entries?.forEach((e: any) => {
            const val = Number(e.reviewer_score !== null && e.reviewer_score !== undefined ? e.reviewer_score : e.calculated_score);
            if (e.category?.section === 'TEACHING') teaching += val;
            else if (e.category?.section === 'RESEARCH') research += val;
            else if (e.category?.section === 'SERVICE') service += val;
          });

          const total = teaching + research + service;

          return (
            <div className="score-overview">
              <ScoreCard label="Teaching" score={teaching} color="#3b82f6" size="sm" />
              <ScoreCard label="Research" score={research} color="#8b5cf6" size="sm" />
              <ScoreCard label="Service" score={service} color="#10b981" size="sm" />
              <ScoreCard label="Total" score={total} color="#f59e0b" />
            </div>
          );
        })()}

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
                  {user?.role === 'REVIEWER' && selectedApp.status === 'REVIEWER_ASSIGNED' && selectedApp.reviewer_id === user.id ? (
                    <EntryScoreInput
                      appId={selectedApp.id}
                      categoryId={entry.category_id}
                      initialScore={entry.reviewer_score !== null ? entry.reviewer_score : entry.calculated_score}
                      onScoreUpdated={(newVal) => setSelectedApp((prev: any) => {
                        const newEntries = prev.category_entries.map((ce: any) => 
                          ce.category_id === entry.category_id ? { ...ce, reviewer_score: newVal } : ce
                        );
                        return { ...prev, category_entries: newEntries };
                      })}
                    />
                  ) : (
                    entry.reviewer_score !== null 
                      ? <><span title="Reviewer Adjusted Score" style={{color: '#f59e0b', fontWeight: 'bold'}}>{Number(entry.reviewer_score).toFixed(1)}</span> <span style={{textDecoration: 'line-through', fontSize: '0.8em', color: '#94a3b8'}}>{Number(entry.calculated_score).toFixed(1)}</span></>
                      : (entry.calculated_score !== null ? Number(entry.calculated_score).toFixed(1) : '—')
                  )}
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
                    <a key={doc.id} href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block' }}>
                      📄 {doc.file_name}
                    </a>
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
                  {user?.role === 'HOD' ? (
                    <>
                      <option value="RECOMMENDED">✅ Recommended</option>
                      <option value="NOT_RECOMMENDED">❌ Not Recommended</option>
                      <option value="REVERTED">↩ Revert to Faculty (Request Changes)</option>
                    </>
                  ) : user?.role === 'PRINCIPAL' ? (
                    <>
                      <option value="APPROVED">✅ Approved</option>
                      <option value="REJECTED">❌ Rejected</option>
                    </>
                  ) : (
                    <>
                      <option value="RECOMMENDED">✅ Recommended</option>
                      <option value="NOT_RECOMMENDED">❌ Not Recommended</option>
                    </>
                  )}
                </select>
              </div>
              {/* Removed overall Reviewer Score input as per requirements */}
              <div className="form-group">
                <label>Comments</label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Add your review comments..."
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>Signature (Optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const fileInput = document.getElementById('signature-upload-input');
                      if (fileInput) (fileInput as HTMLInputElement).click();
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    📷 Select Signature Image
                  </button>
                  <input
                    id="signature-upload-input"
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={e => setSignatureFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                  {signatureFile ? (
                    <span style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 500 }}>
                      ✓ {signatureFile.name}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      No image selected
                    </span>
                  )}
                </div>
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

function EntryScoreInput({ appId, categoryId, initialScore, onScoreUpdated }: { appId: string, categoryId: string, initialScore: any, onScoreUpdated: (data: any) => void }) {
  const [val, setVal] = useState(initialScore !== null ? Number(initialScore).toFixed(1) : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await reviewsApi.updateEntryScore(appId, categoryId, val === '' ? '' : Number(val));
      onScoreUpdated(val === '' ? null : Number(val));
    } catch (err) {
      console.error(err);
      // fallback to initial
      setVal(initialScore !== null ? Number(initialScore).toFixed(1) : '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="number"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={handleSave}
      onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
      disabled={saving}
      style={{ width: '80px', padding: '4px', textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '4px' }}
      title="Edit Score"
    />
  );
}
