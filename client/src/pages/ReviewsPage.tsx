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
  reviews?: any[];
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
    setTimeout(() => setToast(null), 8000);
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
      render: (row: Application) => {
        if (row.status === 'PRINCIPAL_REVIEWED') {
          const principalReview = [...(row.reviews || [])].reverse().find((r: any) => r.role_at_review === 'PRINCIPAL');
          if (principalReview) {
            return <StatusBadge status={principalReview.decision} size="sm" />;
          }
        }
        return <StatusBadge status={row.status} size="sm" />;
      },
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
      width: '180px',
      render: (row: Application) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn-small" onClick={() => handleViewDetail(row)}>
            Review →
          </button>
          <a
            href={`/applications?id=${row.id}`}
            target="_blank"
            rel="noreferrer"
            className="btn-small btn-secondary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            👁️ Details
          </a>
        </div>
      ),
    },
  ];

  // Application detail modal
  if (selectedApp) {
    return (
      <div className="review-detail-page">
        {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button className="btn-back" onClick={() => setSelectedApp(null)} style={{ margin: 0 }}>← Back to List</button>
          <a
            href={`/applications?id=${selectedApp.id}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
          >
            👁️ View Full Application Form
          </a>
        </div>

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
                {Object.entries(entry.raw_value || {}).map(([key, val]) => {
                  if (key.startsWith('item_desc_')) return null;

                  let displayVal: React.ReactNode = String(val);
                  let isBlock = false;

                  if (Array.isArray(val)) {
                    isBlock = true;
                    if (val.length === 0) {
                      displayVal = 'None';
                    } else {
                      displayVal = (
                        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {val.map((item, idx) => {
                            if (typeof item !== 'object' || item === null) return <div key={idx}>[{idx + 1}] {String(item)}</div>;
                            const parts = Object.entries(item)
                              .filter(([k, v]) => !['status', 'proof_documents', 'id'].includes(k) && v !== '' && v != null)
                              .map(([k, v]) => {
                                const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                return `${label}: ${v}`;
                              });
                            return <div key={idx} style={{ fontSize: '0.85em', background: 'rgba(0,0,0,0.03)', padding: '4px 8px', borderRadius: '4px' }}>[{idx + 1}] {parts.join(' | ')}</div>;
                          })}
                        </div>
                      );
                    }
                  } else if (typeof val === 'object' && val !== null) {
                    displayVal = JSON.stringify(val);
                  }

                  return (
                    <span key={key} className="entry-value-chip" style={isBlock ? { display: 'block', width: '100%' } : {}}>
                      {key.replace(/_/g, ' ')}: <strong style={isBlock ? { display: 'block', fontWeight: 'normal' } : {}}>{displayVal}</strong>
                    </span>
                  );
                })}
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
