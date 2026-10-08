import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { applicationsApi, reviewsApi, getFileUrl } from '../lib/api';
import { DynamicCategoryTable } from '../components/DynamicCategoryTable';
import { CATEGORY_COLUMNS } from '../lib/constants';
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

// Keys under which the application form stores a category's table rows
// (see ApplicationsPage: fci_entries / publications / items / records).
const ROW_KEYS = ['publications', 'items', 'records', 'fci_entries'];
function getEntryRows(raw: Record<string, any> | null | undefined): { key: string | null; rows: any[] | null } {
  if (!raw) return { key: null, rows: null };
  for (const k of ROW_KEYS) if (Array.isArray(raw[k])) return { key: k, rows: raw[k] };
  const found = Object.entries(raw).find(([, v]) => Array.isArray(v) && v.some(x => x && typeof x === 'object'));
  return found ? { key: found[0], rows: found[1] as any[] } : { key: null, rows: null };
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
  const [reviewerScoreInput, setReviewerScoreInput] = useState<string>('');
  const [savingOverallScore, setSavingOverallScore] = useState<boolean>(false);

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
      const appData = res.data.data.application;
      setSelectedApp(appData);
      if (appData.reviewer_score !== null && appData.reviewer_score !== undefined) {
        setReviewerScoreInput(Number(appData.reviewer_score).toFixed(1));
      } else if (appData.total_score !== null && appData.total_score !== undefined) {
        setReviewerScoreInput(Number(appData.total_score).toFixed(1));
      } else {
        setReviewerScoreInput('');
      }

      if (user?.role === 'PRINCIPAL') {
        setDecision('APPROVED');
      } else {
        setDecision('RECOMMENDED');
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to load application');
    }
  };

  const handleSaveOverallScore = async () => {
    if (!selectedApp || reviewerScoreInput === '') return;
    setSavingOverallScore(true);
    try {
      const val = Number(reviewerScoreInput);
      const res = await reviewsApi.updateScore(selectedApp.id, val);
      setSelectedApp((prev: any) => ({
        ...prev,
        reviewer_score: res.data.data.reviewer_score,
        final_score: res.data.data.final_score,
      }));
      showToast('success', 'Reviewer score updated successfully');
      loadApplications();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to update reviewer score');
    } finally {
      setSavingOverallScore(false);
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
      const scoreToSend = user?.role === 'REVIEWER' && reviewerScoreInput !== '' ? Number(reviewerScoreInput) : undefined;
      const res = await reviewsApi.submit(selectedApp.id, decision, comments, scoreToSend, signaturePath);
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
          {row.reviewer_score !== null && row.reviewer_score !== undefined && Number(row.reviewer_score) !== Number(row.total_score)
            ? <><span style={{ color: '#f59e0b', fontWeight: 'bold' }} title="Reviewer Score">{Number(row.reviewer_score).toFixed(1)}</span> <span style={{ textDecoration: 'line-through', fontSize: '0.8em', color: '#94a3b8' }} title="Original Score">{row.total_score != null ? Number(row.total_score).toFixed(1) : ''}</span></>
            : ((row.reviewer_score ?? row.total_score) != null ? Number(row.reviewer_score ?? row.total_score).toFixed(1) : '—')}
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
          let teaching = 0, service = 0, regResearch = 0, bonusResearch = 0;
          selectedApp.category_entries?.forEach((e: any) => {
            const val = Number(e.reviewer_score !== null && e.reviewer_score !== undefined ? e.reviewer_score : e.calculated_score);
            const slNo = e.category?.sl_no;
            if (e.category?.section === 'TEACHING') teaching += val;
            else if (e.category?.section === 'RESEARCH') {
              if ([2, 7, 11, 12].includes(slNo)) bonusResearch += val;
              else regResearch += val;
            }
            else if (e.category?.section === 'SERVICE') service += val;
          });

          const designation = selectedApp.faculty?.designation || 'ASSISTANT_PROFESSOR';
          let maxResearch = 10;
          if (designation.includes('ASSOCIATE')) maxResearch = 20;
          else if (designation.includes('PROFESSOR') || designation.includes('HEAD')) maxResearch = 30;

          let resScore = regResearch;
          let bonusScore = bonusResearch;

          if ((resScore + bonusScore) <= maxResearch) {
            resScore = Number((resScore + bonusScore).toFixed(1));
            bonusScore = 0;
          } else if (resScore >= maxResearch) {
            resScore = maxResearch;
            bonusScore = Number(bonusScore.toFixed(1));
          } else {
            const deficit = maxResearch - resScore;
            resScore = maxResearch;
            bonusScore = Number((bonusScore - deficit).toFixed(1));
          }

          const total = Math.min(teaching + service + resScore, 100);
          const finalScore = Number((total + bonusScore).toFixed(1));

          const isReviewerActive = user?.role === 'REVIEWER' && selectedApp.status === 'REVIEWER_ASSIGNED' && selectedApp.reviewer_id === user.id;
          const currentTotal = selectedApp.reviewer_score !== null && selectedApp.reviewer_score !== undefined
            ? Number(selectedApp.reviewer_score)
            : total;
          const currentFinal = selectedApp.final_score !== null && selectedApp.final_score !== undefined
            ? Number(selectedApp.final_score)
            : (selectedApp.reviewer_score !== null && selectedApp.reviewer_score !== undefined ? Number(selectedApp.reviewer_score) : finalScore);

          return (
            <>
              {isReviewerActive && (
                <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.12))', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.6rem' }}>✏️</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#b45309' }}>Reviewer Score Editor</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        You can adjust individual category scores below OR set a direct new score here. This updated score will be reflected to Principal, Accounts, and Faculty later in the pipeline.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>New Score:</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1000"
                      value={reviewerScoreInput}
                      onChange={e => setReviewerScoreInput(e.target.value)}
                      placeholder="0.0"
                      style={{ width: '90px', padding: '6px 10px', borderRadius: '6px', border: '1.5px solid #f59e0b', fontWeight: 700, fontSize: '1rem', textAlign: 'right', color: '#b45309', background: '#fff' }}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleSaveOverallScore}
                      disabled={savingOverallScore || reviewerScoreInput === ''}
                      style={{ padding: '6px 14px', fontSize: '0.85rem', backgroundColor: '#f59e0b', borderColor: '#d97706' }}
                    >
                      {savingOverallScore ? 'Saving...' : '💾 Save New Score'}
                    </button>
                  </div>
                </div>
              )}

              <div className="score-overview">
                <ScoreCard label="Teaching" score={teaching} color="#3b82f6" size="sm" />
                <ScoreCard label="Research" score={resScore} color="#8b5cf6" size="sm" />
                <ScoreCard label="Service" score={service} color="#10b981" size="sm" />
                <ScoreCard label="Total Score" score={currentTotal} color="#f59e0b" />
                <ScoreCard label="* Bonus Score" score={selectedApp.bonus_score !== null && selectedApp.bonus_score !== undefined ? Number(selectedApp.bonus_score) : bonusScore} color="#ec4899" />
                <ScoreCard label="Final Score" score={currentFinal} color="#10b981" />
              </div>
            </>
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
                      onScoreUpdated={(newVal, fullData) => {
                        setSelectedApp((prev: any) => {
                          const newEntries = prev.category_entries.map((ce: any) => 
                            ce.category_id === entry.category_id ? { ...ce, reviewer_score: newVal } : ce
                          );
                          return {
                            ...prev,
                            reviewer_score: fullData?.reviewer_score ?? prev.reviewer_score,
                            final_score: fullData?.final_score ?? prev.final_score,
                            category_entries: newEntries,
                          };
                        });
                        if (fullData?.reviewer_score !== undefined && fullData?.reviewer_score !== null) {
                          setReviewerScoreInput(Number(fullData.reviewer_score).toFixed(1));
                        }
                      }}
                    />
                  ) : (
                    entry.reviewer_score !== null && entry.reviewer_score !== undefined && Number(entry.reviewer_score) !== Number(entry.calculated_score)
                      ? <><span title="Reviewer Adjusted Score" style={{color: '#f59e0b', fontWeight: 'bold'}}>{Number(entry.reviewer_score).toFixed(1)}</span> <span style={{textDecoration: 'line-through', fontSize: '0.8em', color: '#94a3b8'}}>{Number(entry.calculated_score).toFixed(1)}</span></>
                      : ((entry.reviewer_score ?? entry.calculated_score) !== null ? Number(entry.reviewer_score ?? entry.calculated_score).toFixed(1) : '—')
                  )}
                </span>
              </div>
              {(() => {
                const { key: rowsKey, rows } = getEntryRows(entry.raw_value);
                // Row-level proofs appear in the table's Document column; only
                // entry-level ones (no item_index) are listed separately below.
                const looseDocs = rows
                  ? (entry.proof_documents || []).filter((d: any) => d.item_index === null || d.item_index === undefined)
                  : (entry.proof_documents || []);
                return (<>
              {rows && (
                <DynamicCategoryTable
                  sl={entry.category.sl_no}
                  columns={entry.category.input_config?.columns || CATEGORY_COLUMNS[entry.category.sl_no] || []}
                  data={rows}
                  isDraft={false}
                  onAddRow={() => {}}
                  onRemoveRow={() => {}}
                  onChange={() => {}}
                  proofs={entry.proof_documents || []}
                  emptyText="No entries"
                />
              )}
              <div className="entry-values">
                {Object.entries(entry.raw_value || {}).map(([key, val]) => {
                  if (key.startsWith('item_desc_') || key === rowsKey) return null;

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
              {looseDocs.length > 0 && (
                <div className="entry-docs">
                  {looseDocs.map((doc: any) => (
                    <a key={doc.id} href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block' }}>
                      📄 {doc.file_name}
                    </a>
                  ))}
                </div>
              )}
                </>);
              })()}
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
              {user?.role === 'REVIEWER' && (
                <div className="form-group" style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#b45309', fontWeight: 700, marginBottom: '6px' }}>
                    <span>Reviewer Score / New Score (Override)</span>
                    {selectedApp.total_score != null && (
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal' }}>
                        Original Submission Score: <strong>{Number(selectedApp.total_score).toFixed(1)}</strong>
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1000"
                    value={reviewerScoreInput}
                    onChange={e => setReviewerScoreInput(e.target.value)}
                    placeholder="Enter final score..."
                    style={{ width: '100%', padding: '8px 12px', fontSize: '1.05rem', fontWeight: 700, color: '#b45309', border: '1.5px solid #f59e0b', borderRadius: '6px', background: '#fff' }}
                  />
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                    ℹ️ This updated new score will overwrite the system score and be reflected to everyone later in the pipeline (Principal, Accounts, Reports, and Faculty).
                  </p>
                </div>
              )}
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
        <h2>{user?.role === 'HOD' ? 'Department Reviews' : user?.role === 'REVIEWER' ? 'Assigned Reviews' : user?.role === 'CHAIRMAN_REVIEWER' ? 'Chairman Assigned Reviews' : 'Applications for Review'}</h2>
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
  if (role === 'CHAIRMAN_REVIEWER' && status === 'CHAIRMAN_ASSIGNED') return true;
  if (role === 'PRINCIPAL' && (status === 'CHAIRMAN_REVIEWED' || status === 'REVIEWER_REVIEWED')) return true;
  return false;
}

function EntryScoreInput({ appId, categoryId, initialScore, onScoreUpdated }: { appId: string, categoryId: string, initialScore: any, onScoreUpdated: (newVal: any, fullData?: any) => void }) {
  const [val, setVal] = useState(initialScore !== null && initialScore !== undefined ? Number(initialScore).toFixed(1) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVal(initialScore !== null && initialScore !== undefined ? Number(initialScore).toFixed(1) : '');
  }, [initialScore]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await reviewsApi.updateEntryScore(appId, categoryId, val === '' ? '' : Number(val));
      onScoreUpdated(val === '' ? null : Number(val), res.data?.data);
    } catch (err) {
      console.error(err);
      // fallback to initial
      setVal(initialScore !== null && initialScore !== undefined ? Number(initialScore).toFixed(1) : '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <input
        type="number"
        step="0.1"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
        disabled={saving}
        style={{ width: '80px', padding: '4px 6px', textAlign: 'right', border: '1.5px solid #cbd5e1', borderRadius: '4px', fontWeight: 600, color: '#b45309', background: '#fff' }}
        title="Edit Score"
      />
      {saving && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>💾</span>}
    </div>
  );
}
