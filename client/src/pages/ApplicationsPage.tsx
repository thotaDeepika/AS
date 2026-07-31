import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { applicationsApi, getFileUrl } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import ScoreCard from '../components/ScoreCard';
import FileUpload from '../components/FileUpload';

interface Category {
  id: string;
  sl_no: number;
  section: string;
  name: string;
  description: string;
  input_type: string;
  input_config?: any;
}

interface CategoryEntry {
  id: string;
  category_id: string;
  raw_value: Record<string, any>;
  calculated_score: number | null;
  category: Category;
  proof_documents: any[];
}

interface Application {
  id: string;
  academic_year: string;
  status: string;
  total_score: number | null;
  final_score: number | null;
  submitted_at: string | null;
  created_at: string;
  category_entries: CategoryEntry[];
  reviews: any[];
}

const currentYear = new Date().getFullYear();
const academicYear = `${currentYear}-${currentYear + 1}`;

// Section base multipliers by designation (from FINAL_SCORING.md)
// These are NOT caps — they are the values that percentages are multiplied against.
const SECTION_MAXES: Record<string, Record<string, number>> = {
  ASSISTANT_PROFESSOR: { TEACHING: 60, RESEARCH: 10, SERVICE: 30 },
  ASSOCIATE_PROFESSOR: { TEACHING: 50, RESEARCH: 20, SERVICE: 30 },
  PROFESSOR:           { TEACHING: 40, RESEARCH: 30, SERVICE: 30 },
};

function calculateSectionScores(entries: CategoryEntry[], _maxes: Record<string, number>) {
  let teaching = 0;
  let research = 0;
  let service = 0;
  for (const entry of entries) {
    const score = Number(entry.calculated_score || 0);
    if (entry.category?.section === 'TEACHING') teaching += score;
    else if (entry.category?.section === 'RESEARCH') research += score;
    else if (entry.category?.section === 'SERVICE') service += score;
  }
  // No caps — section base values are multipliers, not ceilings
  return {
    teaching,
    research,
    service,
    total: teaching + research + service,
  };
}

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [scoreTotals, setScoreTotals] = useState<any>(null);
  const [historyApps, setHistoryApps] = useState<any[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>('TEACHING');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const designation = user?.designation || 'ASSISTANT_PROFESSOR';
  const maxes = SECTION_MAXES[designation] || SECTION_MAXES.ASSISTANT_PROFESSOR;
  const currentTotals = application ? calculateSectionScores(application.category_entries, maxes) : null;

  // Get form values from application entries
  const getEntryValue = useCallback((categoryId: string, field: string): any => {
    const entry = application?.category_entries.find(e => e.category_id === categoryId);
    return entry?.raw_value?.[field] ?? '';
  }, [application]);

  // Load categories + application
  useEffect(() => {
    const urlId = searchParams.get('id');
    if (user && user.role !== 'FACULTY' && !urlId) {
      if (user.role === 'PRINCIPAL') {
        navigate('/principal-review', { replace: true });
      } else if (user.role === 'HOD' || user.role === 'REVIEWER') {
        navigate('/reviews', { replace: true });
      } else if (user.role === 'ADMIN') {
        navigate('/assign-reviewers', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
      return;
    }

    (async () => {
      try {
        // Load categories and apps independently
        let cats: Category[] = [];
        let apps: any[] = [];

        try {
          const catRes = await applicationsApi.categories();
          cats = catRes.data.data.categories || [];
        } catch (err) {
          console.error('Failed to load categories:', err);
        }

        try {
          const appRes = await applicationsApi.list();
          apps = appRes.data.data.applications || [];
        } catch (err) {
          console.error('Failed to load applications:', err);
        }

        setCategories(cats);
        setHistoryApps(apps);

        let targetAppId = urlId;
        if (!targetAppId && user?.role === 'FACULTY' && apps.length > 0) {
          // Default to the active DRAFT/REVERTED application or the first one
          const targetApp = apps.find((a: any) => a.status === 'DRAFT' || a.status === 'REVERTED') || apps[0];
          targetAppId = targetApp?.id;
        }

        if (targetAppId) {
          const detail = await applicationsApi.getById(targetAppId);
          const app = detail.data.data.application;
          // Convert Prisma Decimal fields to numbers
          if (app.total_score !== null) app.total_score = Number(app.total_score);
          if (app.final_score !== null) app.final_score = Number(app.final_score);
          if (app.bonus_score !== null) app.bonus_score = Number(app.bonus_score);
          setApplication(app);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Create new application
  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await applicationsApi.create(academicYear);
      const detail = await applicationsApi.getById(res.data.data.application.id);
      setApplication(detail.data.data.application);
      showToast('success', 'Application created successfully');
      setHistoryApps(prev => [...prev, detail.data.data.application]);
    } catch (err: any) {
      showToast('error', err.response?.data?.error || err.response?.data?.message || 'Failed to create application');
    } finally {
      setCreating(false);
    }
  };

  // Save a category entry
  const handleSaveEntry = async (categoryId: string, rawValue: Record<string, any>) => {
    if (!application || !['DRAFT', 'REVERTED'].includes(application.status)) return;
    setSaving(prev => ({ ...prev, [categoryId]: true }));
    try {
      await applicationsApi.saveEntry(application.id, categoryId, rawValue);
      // Refresh application
      const detail = await applicationsApi.getById(application.id);
      setApplication(detail.data.data.application);
      showToast('success', 'Entry saved');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  // Upload proof
  const handleUpload = async (categoryId: string, file: File, itemIndex?: number) => {
    if (!application) return;
    setUploading(prev => ({ ...prev, [categoryId]: true }));
    try {
      await applicationsApi.uploadProof(application.id, categoryId, file, itemIndex);
      const detail = await applicationsApi.getById(application.id);
      setApplication(detail.data.data.application);
      showToast('success', 'Document uploaded');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  // Remove proof document
  const handleRemoveProof = async (categoryId: string, docId: string) => {
    if (!application || !['DRAFT', 'REVERTED'].includes(application.status)) return;
    if (!confirm('Are you sure you want to delete this document?')) return;
    setUploading(prev => ({ ...prev, [categoryId]: true }));
    try {
      await applicationsApi.deleteProof(application.id, docId);
      const detail = await applicationsApi.getById(application.id);
      setApplication(detail.data.data.application);
      showToast('success', 'Document deleted');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Delete failed');
    } finally {
      setUploading(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  // Preview scores
  const handlePreviewScores = async () => {
    if (!application) return;
    try {
      const res = await applicationsApi.scorePreview(application.id);
      setScoreTotals(res.data.data.totals);
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Score preview failed');
    }
  };

  // Submit application
  const handleSubmit = async () => {
    if (!application || !['DRAFT', 'REVERTED'].includes(application.status)) return;
    if (!confirm('Submit your application? You will not be able to edit it after submission.')) return;
    setSubmitting(true);
    try {
      const res = await applicationsApi.submit(application.id);
      setApplication({ ...application, status: 'SUBMITTED', ...res.data.data.application });
      setScoreTotals(res.data.data.scores);
      showToast('success', 'Application submitted successfully!');
      // Reload detail
      const detail = await applicationsApi.getById(application.id);
      setApplication(detail.data.data.application);
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreviewPDF = async () => {
    if (!application) return;
    try {
      showToast('success', 'Generating PDF...');
      const response = await api.get(`/reports/appraisal/${application.id}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (e) {
      showToast('error', 'Failed to generate PDF');
    }
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 8000);
  };

  if (loading) return <div className="page-loader"><div className="loader-spinner" /><p>Loading...</p></div>;

  // Faculty role: if no application is open, show create card
  const showCreatePrompt = user?.role === 'FACULTY' && !application;

  const principalReview = [...(application?.reviews || [])].reverse().find((r: any) => r.role_at_review === 'PRINCIPAL');
  const isRejected = principalReview?.decision === 'REJECTED';
  const lastReview = application?.reviews && application.reviews.length > 0
    ? application.reviews[application.reviews.length - 1]
    : null;
  const isReverted = application?.status === 'REVERTED';
  const isDraft = application?.status === 'DRAFT' || application?.status === 'REVERTED';
  const sections = [
    { key: 'TEACHING', label: 'Teaching' },
    { key: 'RESEARCH', label: 'Research' },
    { key: 'SERVICE', label: 'Service & Professional Development' },
  ];
  const categoriesBySection = sections.map(sec => ({
    ...sec,
    items: categories.filter(c => c.section === sec.key).sort((a, b) => a.sl_no - b.sl_no),
  }));

  return (
    <div className="applications-page">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {showCreatePrompt && (
        <div className="app-empty-state" style={{ marginBottom: '2rem' }}>
          <div className="empty-icon">📝</div>
          <h2>Start New Appraisal</h2>
          <p>Start your appraisal by creating a new application for the current academic year ({academicYear}).</p>
          <div style={{ margin: '1.5rem 0' }}>
            <span className="badge-dept" style={{ fontSize: '1.1rem', padding: '0.5rem 1rem' }}>
              Academic Year: {academicYear}
            </span>
          </div>
          <button className="btn-primary" onClick={handleCreate} disabled={creating || historyApps.some(a => a.academic_year === academicYear)}>
            {creating ? 'Creating...' : `Create Application`}
          </button>
        </div>
      )}

      {application && (
        <>
          {/* Reverted Alert Banner — shown to faculty; rejection is internal-only */}
      {isRejected && user?.role !== 'FACULTY' && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px', backgroundColor: '#ef444415', border: '1px solid #ef444440', color: '#ef4444' }}>
          <strong>⚠️ Application Rejected:</strong> This appraisal application has been rejected by the Principal.
          {principalReview.comments && <p style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>Comments: "{principalReview.comments}"</p>}
        </div>
      )}

      {isReverted && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px', backgroundColor: '#eab30815', border: '1px solid #eab30840', color: '#ca8a04' }}>
          <strong>↩️ Changes Requested:</strong> The HOD has reverted your application for changes. Please update the requested fields and re-submit.
          {lastReview.comments && <p style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>Feedback: "{lastReview.comments}"</p>}
        </div>
      )}

      {/* Application Header */}
      <div className="app-header-card">
        <div className="app-header-info">
          <div className="app-header-top">
            <h2>Appraisal Application</h2>
            <StatusBadge status={application.status} facultyView={user?.role === 'FACULTY'} />
          </div>
          <p className="app-header-year">Academic Year: {application.academic_year}</p>
          {application.submitted_at && (
            <p className="app-header-date">Submitted: {new Date(application.submitted_at).toLocaleDateString()}</p>
          )}
        </div>
        <div className="app-header-actions">
          {isDraft && (
            <>
              <button className="btn-secondary" onClick={handlePreviewScores}>
                📊 Preview Score
              </button>
              <button className="btn-secondary" onClick={handlePreviewPDF} style={{ marginLeft: '8px', marginRight: '8px' }}>
                📄 Preview PDF
              </button>
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : '🚀 Submit Application'}
              </button>
            </>
          )}
          {!isDraft && (
            <button className="btn-secondary" onClick={handlePreviewPDF}>
              📄 View PDF
            </button>
          )}
        </div>
      </div>

      {/* Score Overview — designation-aware max values */}
      {application && (
        <div className="score-overview">
          <ScoreCard label="Teaching" score={scoreTotals?.teaching ?? currentTotals?.teaching ?? 0} color="#3b82f6" size="sm" />
          <ScoreCard label="Research" score={scoreTotals?.research ?? currentTotals?.research ?? 0} color="#8b5cf6" size="sm" />
          <ScoreCard label="Service" score={scoreTotals?.service ?? currentTotals?.service ?? 0} color="#10b981" size="sm" />
          <ScoreCard label="Total Score" score={scoreTotals?.total ?? application.total_score ?? currentTotals?.total ?? 0} color="#f59e0b" />
        </div>
      )}

      {/* Category Form Sections */}
      {categoriesBySection.map(({ key, label, items }) => (
        <div key={key} className="form-section">
          <button
            className={`form-section-header ${expandedSection === key ? 'expanded' : ''}`}
            onClick={() => setExpandedSection(expandedSection === key ? null : key)}
          >
            <div className="section-header-left">
              <span className="section-chevron">{expandedSection === key ? '▼' : '▶'}</span>
              <h3>{label}</h3>
              <span className="section-count">{items.length} categories</span>
            </div>
          </button>

          {expandedSection === key && (
            <div className="form-section-body">
              {items.map(cat => (
                <CategoryFormItem
                  key={cat.id}
                  category={cat}
                  entry={application.category_entries.find(e => e.category_id === cat.id)}
                  isDraft={isDraft}
                  saving={saving[cat.id] || false}
                  uploading={uploading[cat.id] || false}
                  onSave={(val) => handleSaveEntry(cat.id, val)}
                  onUpload={(file, index) => handleUpload(cat.id, file, index)}
                  onRemoveProof={(docId) => handleRemoveProof(cat.id, docId)}
                  getEntryValue={(field) => getEntryValue(cat.id, field)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Review History */}
      {application.reviews.length > 0 && user?.role !== 'FACULTY' && (
        <div className="reviews-section">
          <h3>Review History</h3>
          {application.reviews.map((review: any) => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <span className="review-role">{review.role_at_review}</span>
                <span className="review-name">{review.reviewer?.name}</span>
                <StatusBadge status={review.decision} size="sm" />
              </div>
              {review.comments && <p className="review-comments">{review.comments}</p>}
              <span className="review-date">{new Date(review.reviewed_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}

// ─── Individual Category Form Item ─────────────────────────────────────────────

interface CategoryFormItemProps {
  category: Category;
  entry?: CategoryEntry;
  isDraft: boolean;
  saving: boolean;
  uploading: boolean;
  onSave: (val: Record<string, any>) => void;
  onUpload: (file: File, itemIndex?: number) => void;
  onRemoveProof: (docId: string) => void;
  getEntryValue: (field: string) => any;
}

function CategoryFormItem({ category, entry, isDraft, saving, uploading, onSave, onUpload, onRemoveProof }: CategoryFormItemProps) {
  const [localValues, setLocalValues] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  // Initialize from entry only if user hasn't made unsaved changes
  useEffect(() => {
    if (entry?.raw_value && !dirtyRef.current) {
      setLocalValues(entry.raw_value);
    }
  }, [entry?.raw_value]);

  const updateField = (field: string, value: any) => {
    setLocalValues(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    dirtyRef.current = true;
  };

  const handleSave = () => {
    onSave(localValues);
    setDirty(false);
    dirtyRef.current = false;
  };

  // Determine max attachments from category config
  const maxAttachments = (category as any).input_config?.max_attachments || 1;

  // Generate input fields based on category sl_no (FINAL_SCORING.md)
  const renderInput = () => {
    const sl = category.sl_no;

    // ── TEACHING ──

    // Category 1: FCI Score
    if (sl === 1) {
      const fciEntries = localValues.fci_entries || [];

      const calculateColumnAverages = (entries: any[]) => {
        let academicSum = 0; let academicCount = 0;
        let attitudeSum = 0; let attitudeCount = 0;
        let disciplineSum = 0; let disciplineCount = 0;

        entries.forEach(entry => {
          const academic = parseFloat(entry.academic_score);
          const attitude = parseFloat(entry.attitude);
          const discipline = parseFloat(entry.discipline);

          if (!isNaN(academic)) { academicSum += academic; academicCount++; }
          if (!isNaN(attitude)) { attitudeSum += attitude; attitudeCount++; }
          if (!isNaN(discipline)) { disciplineSum += discipline; disciplineCount++; }
        });

        const academicAvg = academicCount > 0 ? academicSum / academicCount : null;
        const attitudeAvg = attitudeCount > 0 ? attitudeSum / attitudeCount : null;
        const disciplineAvg = disciplineCount > 0 ? disciplineSum / disciplineCount : null;

        return { academicAvg, attitudeAvg, disciplineAvg };
      };

      const { academicAvg, attitudeAvg, disciplineAvg } = calculateColumnAverages(fciEntries);

      const calculateFciPercentage = (entries: any[]) => {
        if (!entries || entries.length === 0) return '';
        const avgs = calculateColumnAverages(entries);

        let totalAvgSum = 0;
        let totalAvgCount = 0;
        
        if (avgs.academicAvg !== null) { totalAvgSum += avgs.academicAvg; totalAvgCount++; }
        if (avgs.attitudeAvg !== null) { totalAvgSum += avgs.attitudeAvg; totalAvgCount++; }
        if (avgs.disciplineAvg !== null) { totalAvgSum += avgs.disciplineAvg; totalAvgCount++; }

        return totalAvgCount > 0 ? parseFloat((totalAvgSum / totalAvgCount).toFixed(2)) : '';
      };

      const handleAddFciEntry = () => {
        const newEntries = [...fciEntries, { academic_year: '', subjects: '', academic_score: '', attitude: '', discipline: '' }];
        updateField('fci_entries', newEntries);
      };

      const handleRemoveFciEntry = (index: number) => {
        const newEntries = fciEntries.filter((_: any, i: number) => i !== index);
        updateField('fci_entries', newEntries);
        updateField('fci_percentage', calculateFciPercentage(newEntries));
      };

      const handleFciEntryChange = (index: number, field: string, value: string) => {
        const newEntries = [...fciEntries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        updateField('fci_entries', newEntries);
        updateField('fci_percentage', calculateFciPercentage(newEntries));
      };

      return (
        <div className="category-field fci-section">
          <label style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            FCI Score Details
          </label>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Academic Year</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Subjects</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Academic Score</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Attitude</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Discipline</th>
                  {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {fciEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No FCI entries added. Click "+ Add Row" below to start.
                    </td>
                  </tr>
                )}
                {fciEntries.map((entry: any, index: number) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={entry.academic_year || ''}
                        onChange={e => handleFciEntryChange(index, 'academic_year', e.target.value)}
                        disabled={!isDraft}
                        placeholder="e.g. 2023-2024"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={entry.subjects || ''}
                        onChange={e => handleFciEntryChange(index, 'subjects', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Subject Name"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="number" min="0" max="100" step="0.1"
                        value={entry.academic_score || ''}
                        onChange={e => handleFciEntryChange(index, 'academic_score', e.target.value)}
                        disabled={!isDraft}
                        placeholder="0-100"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="number" min="0" max="100" step="0.1"
                        value={entry.attitude || ''}
                        onChange={e => handleFciEntryChange(index, 'attitude', e.target.value)}
                        disabled={!isDraft}
                        placeholder="0-100"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="number" min="0" max="100" step="0.1"
                        value={entry.discipline || ''}
                        onChange={e => handleFciEntryChange(index, 'discipline', e.target.value)}
                        disabled={!isDraft}
                        placeholder="0-100"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    {isDraft && (
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveFciEntry(index)} 
                          style={{ 
                            padding: '4px 8px', 
                            backgroundColor: '#ff4d4f', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {fciEntries.length > 0 && (
                <tfoot style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                  <tr>
                    <td colSpan={2} style={{ border: '1px solid #333', padding: '10px', textAlign: 'right' }}>Column Averages:</td>
                    <td style={{ border: '1px solid #333', padding: '10px' }}>
                      {academicAvg !== null ? academicAvg.toFixed(2) : '-'}
                    </td>
                    <td style={{ border: '1px solid #333', padding: '10px' }}>
                      {attitudeAvg !== null ? attitudeAvg.toFixed(2) : '-'}
                    </td>
                    <td style={{ border: '1px solid #333', padding: '10px' }}>
                      {disciplineAvg !== null ? disciplineAvg.toFixed(2) : '-'}
                    </td>
                    {isDraft && <td style={{ border: '1px solid #333', padding: '10px' }}></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {isDraft && (
            <button 
              type="button" 
              onClick={handleAddFciEntry} 
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                marginBottom: '1rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                display: 'inline-block'
              }}
            >
              + Add Row
            </button>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <label>Average FCI Score (%)</label>
            <input
              type="number"
              min="0" max="100" step="0.1"
              value={localValues.fci_percentage ?? ''}
              disabled={true}
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
              placeholder="e.g. 82.5"
            />
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
              This is auto-calculated based on the column averages above.
            </small>
          </div>
        </div>
      );
    }

    // ── RESEARCH ──

    // Categories 2-4: Paper/Publication counts
    if (sl >= 2 && sl <= 4) {
      const publications = localValues.publications || [];

      const handleAddPublication = () => {
        const newPubs = [...publications, { doi: '', paperTitle: '', journalName: '', publicationDate: '', issn: '', journalCategory: '', publisher: '', isbn: '', status: 'Published', expectedPublicationDate: '' }];
        updateField('publications', newPubs);
        updateField('count', newPubs.length);
      };

      const handleRemovePublication = (index: number) => {
        const newPubs = publications.filter((_: any, i: number) => i !== index);
        updateField('publications', newPubs);
        updateField('count', newPubs.length);
      };

      const handlePublicationChange = (index: number, field: string, value: string) => {
        const newPubs = [...publications];
        newPubs[index] = { ...newPubs[index], [field]: value };
        updateField('publications', newPubs);
      };

      const handleFetchDoi = async (doiValue: string, index: number) => {
        if (!doiValue) {
          alert('Please enter a DOI first.');
          return;
        }

        try {
          const normalizeDoi = (doi: string) => {
            let cleaned = doi.trim();
            cleaned = cleaned.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
            cleaned = cleaned.replace(/^doi:\s*/i, '');
            return cleaned;
          };
          const cleanDoi = normalizeDoi(doiValue);
          
          const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);
          if (!response.ok) {
            throw new Error('DOI lookup failed. Please check the DOI and try again.');
          }
          const data = await response.json();
          const title = Array.isArray(data?.message?.title) ? data.message.title[0] : '';
          const journal = Array.isArray(data?.message?.['container-title']) ? data.message['container-title'][0] : '';
          const issnArray = data?.message?.ISSN || [];
          const extractedIssn = Array.isArray(issnArray) && issnArray.length > 0 ? issnArray[0] : '';
          
          const parseCrossrefDate = (message: any) => {
            const dateParts = message?.published?.['date-parts']?.[0]
              || message?.['published-print']?.['date-parts']?.[0]
              || message?.issued?.['date-parts']?.[0]
              || message?.created?.['date-parts']?.[0];
            if (!Array.isArray(dateParts) || dateParts.length === 0) return '';
            const [year, month = 1, day = 1] = dateParts;
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          };
          const publicationDateValue = parseCrossrefDate(data?.message);
          const publicationYearValue = publicationDateValue ? publicationDateValue.split('-')[0] : '';

          const isbnArray = data?.message?.ISBN || [];
          let extractedIsbn = Array.isArray(isbnArray) && isbnArray.length > 0 ? isbnArray[0] : '';
          extractedIsbn = extractedIsbn.replace(/http:\/\/id\.crossref\.org\/isbn\//, '');
          const publisherValue = data?.message?.publisher || '';

          const authors = data?.message?.author;
          let authorDetailsValue = '';
          if (Array.isArray(authors)) {
            authorDetailsValue = authors.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).join(', ');
          }

          if (!title && !journal) {
            alert('DOI found but title/journal metadata is unavailable.');
            return;
          }

          const newPubs = [...(localValues.publications || [])];
          newPubs[index] = {
            ...newPubs[index],
            paperTitle: title || newPubs[index].paperTitle,
            authorDetails: authorDetailsValue || newPubs[index].authorDetails,
            journalName: journal || newPubs[index].journalName,
            publicationDate: (sl === 2 ? publicationDateValue : publicationYearValue) || newPubs[index].publicationDate,
            issn: extractedIssn || newPubs[index].issn,
            publisher: publisherValue || newPubs[index].publisher,
            isbn: extractedIsbn || newPubs[index].isbn,
          };
          updateField('publications', newPubs);
          updateField('count', newPubs.length);

          alert('Paper metadata loaded from DOI.');
        } catch (err: any) {
          alert(err.message || 'Unable to fetch metadata from DOI.');
        }
      };

      return (
        <div className="category-field publications-section">
          <label style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            {sl === 2 ? 'Publications Details' : 'Conference Details'}
          </label>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                {sl === 2 ? (
                  <tr>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>DOI</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Paper Title (Auto)</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Author Details (Auto)</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Journal Name (Auto)</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>
                      <div title="Acceptance or Publication Date">Date</div>
                    </th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>ISSN (Auto)</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Category (Q1-Q4)</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>
                    {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                  </tr>
                ) : (
                  <tr>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>DOI</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Paper Title (Auto)</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Authors (Auto)</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Conference Name (Auto)</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Publisher</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>
                      <div title="Acceptance or Publication Year">Year</div>
                    </th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>ISBN</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>ISSN (if available)</th>
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>
                    {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                  </tr>
                )}
              </thead>
              <tbody>
                {publications.length === 0 && (
                  <tr>
                    <td colSpan={isDraft ? (sl === 2 ? 9 : 10) : (sl === 2 ? 8 : 9)} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No {sl === 2 ? 'publications' : 'conferences'} added. Click "+ Add {sl === 2 ? 'Publication' : 'Conference'}" below to start.
                    </td>
                  </tr>
                )}
                {publications.map((pub: any, index: number) => (
                  <tr key={index}>
                    {sl === 2 ? (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <select
                            value={pub.status || 'Published'}
                            onChange={e => handlePublicationChange(index, 'status', e.target.value)}
                            disabled={!isDraft}
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="Published">Published</option>
                            <option value="Accepted">Accepted</option>
                          </select>
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '180px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="text"
                              value={pub.doi || ''}
                              onChange={e => handlePublicationChange(index, 'doi', e.target.value)}
                              disabled={!isDraft}
                              placeholder={pub.status === 'Accepted' ? 'Pending (Optional)' : 'DOI'}
                              style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                            {isDraft && pub.status !== 'Accepted' && (
                              <button type="button" onClick={() => handleFetchDoi(pub.doi, index)} style={{ padding: '6px 8px', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                Fetch
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input
                            type="text"
                            value={pub.paperTitle || ''}
                            onChange={e => handlePublicationChange(index, 'paperTitle', e.target.value)}
                            disabled={!isDraft}
                            placeholder="Title"
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f8fafc' }}
                          />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input
                            type="text"
                            value={pub.authorDetails || ''}
                            onChange={e => handlePublicationChange(index, 'authorDetails', e.target.value)}
                            disabled={!isDraft}
                            placeholder="Authors"
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f8fafc' }}
                          />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input
                            type="text"
                            value={pub.journalName || ''}
                            onChange={e => handlePublicationChange(index, 'journalName', e.target.value)}
                            disabled={!isDraft}
                            placeholder="Journal"
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f8fafc' }}
                          />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>{pub.status === 'Accepted' ? 'Acceptance Date' : 'Pub Date'}</div>
                            <input
                              type="date"
                              value={pub.publicationDate || ''}
                              onChange={e => handlePublicationChange(index, 'publicationDate', e.target.value)}
                              disabled={!isDraft}
                              style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                          {pub.status === 'Accepted' && (
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#666' }}>Expected Pub Date (Optional)</div>
                              <input
                                type="date"
                                value={pub.expectedPublicationDate || ''}
                                onChange={e => handlePublicationChange(index, 'expectedPublicationDate', e.target.value)}
                                disabled={!isDraft}
                                style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                              />
                            </div>
                          )}
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                          {pub.status === 'Accepted' ? (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Pending</span>
                          ) : (
                            <input
                              type="text"
                              value={pub.issn || ''}
                              onChange={e => handlePublicationChange(index, 'issn', e.target.value)}
                              disabled={!isDraft}
                              placeholder="ISSN"
                              style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f8fafc' }}
                            />
                          )}
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '120px', textAlign: pub.status === 'Accepted' ? 'center' : 'left' }}>
                          {pub.status === 'Accepted' ? (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Pending</span>
                          ) : (
                            <>
                              <select
                                value={pub.journalCategory || ''}
                                onChange={e => handlePublicationChange(index, 'journalCategory', e.target.value)}
                                disabled={!isDraft}
                                style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}
                              >
                                <option value="">Select</option>
                                <option value="Q1">Q1</option>
                                <option value="Q2">Q2</option>
                                <option value="Q3">Q3</option>
                                <option value="Q4">Q4</option>
                                <option value="SCI">SCI</option>
                                <option value="SCIE">SCIE</option>
                                <option value="Scopus">Scopus</option>
                                <option value="WoS">WoS</option>
                                <option value="Other">Other</option>
                              </select>
                              {pub.issn && (
                                <a 
                                  href={`https://www.scimagojr.com/journalsearch.php?q=${encodeURIComponent(pub.issn)}&tip=issn`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  style={{ display: 'block', fontSize: '0.75rem', marginTop: '4px', color: '#2563eb', textDecoration: 'underline' }}
                                >
                                  Verify on ScimagoJR
                                </a>
                              )}
                            </>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <select
                            value={pub.status || 'Published'}
                            onChange={e => handlePublicationChange(index, 'status', e.target.value)}
                            disabled={!isDraft}
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="Published">Published</option>
                            <option value="Accepted">Accepted</option>
                          </select>
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '180px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="text"
                              value={pub.doi || ''}
                              onChange={e => handlePublicationChange(index, 'doi', e.target.value)}
                              disabled={!isDraft}
                              placeholder={pub.status === 'Accepted' ? 'Pending (Optional)' : 'DOI'}
                              style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                            {isDraft && pub.status !== 'Accepted' && (
                              <button type="button" onClick={() => handleFetchDoi(pub.doi, index)} style={{ padding: '6px 8px', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                Fetch
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input
                            type="text"
                            value={pub.paperTitle || ''}
                            onChange={e => handlePublicationChange(index, 'paperTitle', e.target.value)}
                            disabled={!isDraft}
                            placeholder="Title"
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f8fafc' }}
                          />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input
                            type="text"
                            value={pub.authorDetails || ''}
                            onChange={e => handlePublicationChange(index, 'authorDetails', e.target.value)}
                            disabled={!isDraft}
                            placeholder="Authors"
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input
                            type="text"
                            value={pub.journalName || ''}
                            onChange={e => handlePublicationChange(index, 'journalName', e.target.value)}
                            disabled={!isDraft}
                            placeholder="Conference"
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input
                            type="text"
                            value={pub.publisher || ''}
                            onChange={e => handlePublicationChange(index, 'publisher', e.target.value)}
                            disabled={!isDraft}
                            placeholder="Publisher"
                            style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '100px' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>{pub.status === 'Accepted' ? 'Acceptance Yr' : 'Pub Yr'}</div>
                            <input
                              type="number"
                              value={pub.publicationDate || ''}
                              onChange={e => handlePublicationChange(index, 'publicationDate', e.target.value)}
                              disabled={!isDraft}
                              placeholder="YYYY"
                              style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                          {pub.status === 'Accepted' && (
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#666' }}>Expected Yr (Optional)</div>
                              <input
                                type="number"
                                value={pub.expectedPublicationDate || ''}
                                onChange={e => handlePublicationChange(index, 'expectedPublicationDate', e.target.value)}
                                disabled={!isDraft}
                                placeholder="YYYY"
                                style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                              />
                            </div>
                          )}
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                          {pub.status === 'Accepted' ? (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Pending</span>
                          ) : (
                            <input
                              type="text"
                              value={pub.isbn || ''}
                              onChange={e => handlePublicationChange(index, 'isbn', e.target.value)}
                              disabled={!isDraft}
                              placeholder="ISBN"
                              style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}
                            />
                          )}
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                          {pub.status === 'Accepted' ? (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Pending</span>
                          ) : (
                            <input
                              type="text"
                              value={pub.issn || ''}
                              onChange={e => handlePublicationChange(index, 'issn', e.target.value)}
                              disabled={!isDraft}
                              placeholder="ISSN"
                              style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}
                            />
                          )}
                        </td>
                      </>
                    )}
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '150px', backgroundColor: pub.status === 'Accepted' ? '#fff' : '#f8fafc', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>
                        {pub.status === 'Accepted' ? 'Upload Acceptance Letter' : 'Upload Published Paper (Optional)'}
                      </div>
                      {(() => {
                        const doc = entry?.proof_documents?.find((d: any) => d.item_index === index);
                        if (doc) {
                          return (
                            <div className="category-docs">
                              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block', fontSize: '0.75rem', padding: '4px 8px' }}>
                                📄 {doc.file_name}
                              </a>
                              {isDraft && (
                                <button type="button" className="btn-small" style={{ display: 'block', marginTop: '4px', padding: '2px 4px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', margin: '4px auto 0' }} onClick={() => onRemoveProof(doc.id)}>
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          );
                        } else if (isDraft) {
                          return (
                            <FileUpload
                              onFileSelect={(file) => onUpload(file, index)}
                              uploading={uploading}
                              maxFiles={1}
                              uploadedFiles={[]}
                            />
                          );
                        } else {
                          return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No document</span>;
                        }
                      })()}
                    </td>
                    {isDraft && (
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => handleRemovePublication(index)} 
                          style={{ 
                            padding: '4px 8px', 
                            backgroundColor: '#ff4d4f', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDraft && (
            <button 
              type="button" 
              onClick={handleAddPublication} 
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                marginBottom: '1rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                display: 'inline-block'
              }}
            >
              + Add Publication
            </button>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <label>Total Papers/Publications</label>
            <input
              type="number"
              value={localValues.count ?? 0}
              disabled={true}
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '100px' }}
            />
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
              This is auto-calculated based on the table entries above.
            </small>
          </div>
        </div>
      );
    }

    // Category 5: Books/Chapters (composite)
    if (sl === 5) {
      const items = localValues.items || [];

      const handleAddItem = () => {
        const newItems = [...items, { bookType: 'Book', title: '', authors: '', publisher: '', isbn: '', publicationDate: '' }];
        const booksCount = newItems.filter(i => i.bookType === 'Book').length;
        const chaptersCount = newItems.filter(i => i.bookType === 'Book Chapter' || i.bookType === 'Edited Book').length;
        updateField('items', newItems);
        updateField('books', booksCount);
        updateField('chapters', chaptersCount);
      };

      const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_: any, i: number) => i !== index);
        const booksCount = newItems.filter((i: any) => i.bookType === 'Book').length;
        const chaptersCount = newItems.filter((i: any) => i.bookType === 'Book Chapter' || i.bookType === 'Edited Book').length;
        updateField('items', newItems);
        updateField('books', booksCount);
        updateField('chapters', chaptersCount);
      };

      const handleItemChange = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        const booksCount = newItems.filter(i => i.bookType === 'Book').length;
        const chaptersCount = newItems.filter(i => i.bookType === 'Book Chapter' || i.bookType === 'Edited Book').length;
        updateField('items', newItems);
        updateField('books', booksCount);
        updateField('chapters', chaptersCount);
      };

      return (
        <div className="category-field publications-section">
          <label style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Books & Chapters Details
          </label>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Type</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Title</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Authors</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Publisher</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>ISBN</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Year</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>
                  {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={isDraft ? 8 : 7} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No books/chapters added. Click "+ Add Entry" below to start.
                    </td>
                  </tr>
                )}
                {items.map((item: any, index: number) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                      <select
                        value={item.bookType || 'Book'}
                        onChange={e => handleItemChange(index, 'bookType', e.target.value)}
                        disabled={!isDraft}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      >
                        <option value="Book">Book</option>
                        <option value="Book Chapter">Book Chapter</option>
                        <option value="Edited Book">Edited Book</option>
                      </select>
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.title || ''}
                        onChange={e => handleItemChange(index, 'title', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Title"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.authors || ''}
                        onChange={e => handleItemChange(index, 'authors', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Authors"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.publisher || ''}
                        onChange={e => handleItemChange(index, 'publisher', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Publisher"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.isbn || ''}
                        onChange={e => handleItemChange(index, 'isbn', e.target.value)}
                        disabled={!isDraft}
                        placeholder="ISBN"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '100px' }}>
                      <input
                        type="number"
                        value={item.publicationDate || ''}
                        onChange={e => handleItemChange(index, 'publicationDate', e.target.value)}
                        disabled={!isDraft}
                        placeholder="YYYY"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '150px', textAlign: 'center' }}>
                      {(() => {
                        const doc = entry?.proof_documents?.find((d: any) => d.item_index === index);
                        if (doc) {
                          return (
                            <div className="category-docs">
                              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block', fontSize: '0.75rem', padding: '4px 8px' }}>
                                📄 {doc.file_name}
                              </a>
                              {isDraft && (
                                <button type="button" className="btn-small" style={{ display: 'block', marginTop: '4px', padding: '2px 4px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', margin: '4px auto 0' }} onClick={() => onRemoveProof(doc.id)}>
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          );
                        } else if (isDraft) {
                          return (
                            <FileUpload
                              onFileSelect={(file) => onUpload(file, index)}
                              uploading={uploading}
                              maxFiles={1}
                              uploadedFiles={[]}
                            />
                          );
                        } else {
                          return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No document</span>;
                        }
                      })()}
                    </td>
                    {isDraft && (
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveItem(index)} 
                          style={{ 
                            padding: '4px 8px', 
                            backgroundColor: '#ff4d4f', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDraft && (
            <button 
              type="button" 
              onClick={handleAddItem} 
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              + Add Entry
            </button>
          )}

          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem' }}>Books Authored:</label>
              <input
                type="number"
                value={localValues.books ?? 0}
                disabled={true}
                style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '80px', marginLeft: '0.5rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem' }}>Book Chapters:</label>
              <input
                type="number"
                value={localValues.chapters ?? 0}
                disabled={true}
                style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '80px', marginLeft: '0.5rem' }}
              />
            </div>
          </div>
        </div>
      );
    }

    // Categories 6-7: Disclosures Filed / Patents Granted
    if (sl === 6 || sl === 7) {
      const items = localValues.items || [];

      const handleAddItem = () => {
        const newItems = [...items, sl === 6 
          ? { title: '', disclosureNo: '', filingDate: '' }
          : { title: '', patentNo: '', country: '', grantDate: '' }
        ];
        updateField('items', newItems);
        updateField('count', newItems.length);
      };

      const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_: any, i: number) => i !== index);
        updateField('items', newItems);
        updateField('count', newItems.length);
      };

      const handleItemChange = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        updateField('items', newItems);
      };

      return (
        <div className="category-field publications-section">
          <label style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            {sl === 6 ? 'Patent Disclosures Details' : 'Patents Granted Details'}
          </label>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>
                    {sl === 6 ? 'Disclosure Title' : 'Patent Title'}
                  </th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>
                    {sl === 6 ? 'Disclosure No.' : 'Patent No.'}
                  </th>
                  {sl === 7 && (
                    <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Country</th>
                  )}
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>
                    {sl === 6 ? 'Filing Date' : 'Grant Date'}
                  </th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>
                  {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={isDraft ? (sl === 7 ? 6 : 5) : (sl === 7 ? 5 : 4)} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No entries added. Click "+ Add Entry" below to start.
                    </td>
                  </tr>
                )}
                {items.map((item: any, index: number) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.title || ''}
                        onChange={e => handleItemChange(index, 'title', e.target.value)}
                        disabled={!isDraft}
                        placeholder={sl === 6 ? 'Disclosure Title' : 'Patent Title'}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                      <input
                        type="text"
                        value={sl === 6 ? (item.disclosureNo || '') : (item.patentNo || '')}
                        onChange={e => handleItemChange(index, sl === 6 ? 'disclosureNo' : 'patentNo', e.target.value)}
                        disabled={!isDraft}
                        placeholder={sl === 6 ? 'Disclosure No.' : 'Patent No.'}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    {sl === 7 && (
                      <td style={{ border: '1px solid #333', padding: '8px' }}>
                        <input
                          type="text"
                          value={item.country || ''}
                          onChange={e => handleItemChange(index, 'country', e.target.value)}
                          disabled={!isDraft}
                          placeholder="Country"
                          style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </td>
                    )}
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '150px' }}>
                      <input
                        type="date"
                        value={sl === 6 ? (item.filingDate || '') : (item.grantDate || '')}
                        onChange={e => handleItemChange(index, sl === 6 ? 'filingDate' : 'grantDate', e.target.value)}
                        disabled={!isDraft}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '150px', textAlign: 'center' }}>
                      {(() => {
                        const doc = entry?.proof_documents?.find((d: any) => d.item_index === index);
                        if (doc) {
                          return (
                            <div className="category-docs">
                              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block', fontSize: '0.75rem', padding: '4px 8px' }}>
                                📄 {doc.file_name}
                              </a>
                              {isDraft && (
                                <button type="button" className="btn-small" style={{ display: 'block', marginTop: '4px', padding: '2px 4px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', margin: '4px auto 0' }} onClick={() => onRemoveProof(doc.id)}>
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          );
                        } else if (isDraft) {
                          return (
                            <FileUpload
                              onFileSelect={(file) => onUpload(file, index)}
                              uploading={uploading}
                              maxFiles={1}
                              uploadedFiles={[]}
                            />
                          );
                        } else {
                          return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No document</span>;
                        }
                      })()}
                    </td>
                    {isDraft && (
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveItem(index)} 
                          style={{ 
                            padding: '4px 8px', 
                            backgroundColor: '#ff4d4f', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDraft && (
            <button 
              type="button" 
              onClick={handleAddItem} 
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              + Add Entry
            </button>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem' }}>Total Count:</label>
            <input
              type="number"
              value={localValues.count ?? 0}
              disabled={true}
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '80px', marginLeft: '0.5rem' }}
            />
          </div>
        </div>
      );
    }

    // Categories 8-10: Research Guidance (UG/PG/PhD)
    if (sl >= 8 && sl <= 10) {
      const items = localValues.items || [];

      const handleAddItem = () => {
        const newItems = [...items, { studentName: '', programme: '', researchTitle: '', role: '', status: 'Ongoing' }];
        updateField('items', newItems);
        updateField('count', newItems.length);
      };

      const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_: any, i: number) => i !== index);
        updateField('items', newItems);
        updateField('count', newItems.length);
      };

      const handleItemChange = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        updateField('items', newItems);
      };

      return (
        <div className="category-field publications-section">
          <label style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Research Guidance Details
          </label>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Student Name</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Programme</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Research Title</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Role</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>
                  {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={isDraft ? 7 : 6} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No entries added. Click "+ Add Entry" below to start.
                    </td>
                  </tr>
                )}
                {items.map((item: any, index: number) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.studentName || ''}
                        onChange={e => handleItemChange(index, 'studentName', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Student Name"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.programme || ''}
                        onChange={e => handleItemChange(index, 'programme', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Programme"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.researchTitle || ''}
                        onChange={e => handleItemChange(index, 'researchTitle', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Research Title"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.role || ''}
                        onChange={e => handleItemChange(index, 'role', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Role"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                      <select
                        value={item.status || 'Ongoing'}
                        onChange={e => handleItemChange(index, 'status', e.target.value)}
                        disabled={!isDraft}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      >
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '150px', textAlign: 'center' }}>
                      {(() => {
                        const doc = entry?.proof_documents?.find((d: any) => d.item_index === index);
                        if (doc) {
                          return (
                            <div className="category-docs">
                              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block', fontSize: '0.75rem', padding: '4px 8px' }}>
                                📄 {doc.file_name}
                              </a>
                              {isDraft && (
                                <button type="button" className="btn-small" style={{ display: 'block', marginTop: '4px', padding: '2px 4px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', margin: '4px auto 0' }} onClick={() => onRemoveProof(doc.id)}>
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          );
                        } else if (isDraft) {
                          return (
                            <FileUpload
                              onFileSelect={(file) => onUpload(file, index)}
                              uploading={uploading}
                              maxFiles={1}
                              uploadedFiles={[]}
                            />
                          );
                        } else {
                          return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No document</span>;
                        }
                      })()}
                    </td>
                    {isDraft && (
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveItem(index)} 
                          style={{ 
                            padding: '4px 8px', 
                            backgroundColor: '#ff4d4f', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDraft && (
            <button 
              type="button" 
              onClick={handleAddItem} 
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              + Add Entry
            </button>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem' }}>Total Count:</label>
            <input
              type="number"
              value={localValues.count ?? 0}
              disabled={true}
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '80px', marginLeft: '0.5rem' }}
            />
          </div>
        </div>
      );
    }

    // Categories 11-12: Funded/Consulting Projects (currency slab)
    if (sl === 11 || sl === 12) {
      const items = localValues.items || [];

      const updateAmountLakhs = (newItems: any[]) => {
        const total = newItems.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
        updateField('amount_lakhs', total);
      };

      const handleAddItem = () => {
        const newItems = [...items, { title: '', agency: '', amount: '', role: '', duration: '' }];
        updateField('items', newItems);
        updateAmountLakhs(newItems);
      };

      const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_: any, i: number) => i !== index);
        updateField('items', newItems);
        updateAmountLakhs(newItems);
      };

      const handleItemChange = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        updateField('items', newItems);
        if (field === 'amount') {
          updateAmountLakhs(newItems);
        }
      };

      return (
        <div className="category-field publications-section">
          <label style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            {sl === 11 ? 'Funded Projects Details' : 'Consulting Projects Details'}
          </label>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Project Title</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>{sl === 11 ? 'Funding Agency' : 'Client / Org'}</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Amount (Lakhs ₹)</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Role</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Duration / Status</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>
                  {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={isDraft ? 7 : 6} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No projects added. Click "+ Add Entry" below to start.
                    </td>
                  </tr>
                )}
                {items.map((item: any, index: number) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.title || ''}
                        onChange={e => handleItemChange(index, 'title', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Project Title"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.agency || ''}
                        onChange={e => handleItemChange(index, 'agency', e.target.value)}
                        disabled={!isDraft}
                        placeholder={sl === 11 ? 'Agency' : 'Client'}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '100px' }}>
                      <input
                        type="number"
                        min="0" step="0.01"
                        value={item.amount || ''}
                        onChange={e => handleItemChange(index, 'amount', e.target.value)}
                        disabled={!isDraft}
                        placeholder="e.g. 5.5"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.role || ''}
                        onChange={e => handleItemChange(index, 'role', e.target.value)}
                        disabled={!isDraft}
                        placeholder="Role (e.g. PI)"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.duration || ''}
                        onChange={e => handleItemChange(index, 'duration', e.target.value)}
                        disabled={!isDraft}
                        placeholder="e.g. 2 Years, Ongoing"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '150px', textAlign: 'center' }}>
                      {(() => {
                        const doc = entry?.proof_documents?.find((d: any) => d.item_index === index);
                        if (doc) {
                          return (
                            <div className="category-docs">
                              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block', fontSize: '0.75rem', padding: '4px 8px' }}>
                                📄 {doc.file_name}
                              </a>
                              {isDraft && (
                                <button type="button" className="btn-small" style={{ display: 'block', marginTop: '4px', padding: '2px 4px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', margin: '4px auto 0' }} onClick={() => onRemoveProof(doc.id)}>
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          );
                        } else if (isDraft) {
                          return (
                            <FileUpload
                              onFileSelect={(file) => onUpload(file, index)}
                              uploading={uploading}
                              maxFiles={1}
                              uploadedFiles={[]}
                            />
                          );
                        } else {
                          return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No document</span>;
                        }
                      })()}
                    </td>
                    {isDraft && (
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveItem(index)} 
                          style={{ 
                            padding: '4px 8px', 
                            backgroundColor: '#ff4d4f', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDraft && (
            <button 
              type="button" 
              onClick={handleAddItem} 
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              + Add Entry
            </button>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem' }}>Total Funding Amount (Lakhs ₹):</label>
            <input
              type="number"
              value={localValues.amount_lakhs ?? 0}
              disabled={true}
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '100px', marginLeft: '0.5rem' }}
            />
          </div>
        </div>
      );
    }

    // ── SERVICE ──

    // Categories 13-18: Table format
    if ([13, 14, 15, 16, 17, 18].includes(sl)) {
      const records = localValues.records || [];

      const updateDays = (recs: any[]) => {
        let total = 0;
        recs.forEach(r => {
          if (r.startDate && r.endDate) {
            const s = new Date(r.startDate);
            const e = new Date(r.endDate);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
              const diffTime = Math.abs(e.getTime() - s.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
              total += diffDays;
            }
          }
        });
        updateField('days', total);
      };

      const handleAddRecord = () => {
        const newRecords = [...records, {}];
        updateField('records', newRecords);
        updateField('count', newRecords.length);
        if (sl === 14) updateDays(newRecords);
      };

      const handleRemoveRecord = (index: number) => {
        const newRecords = records.filter((_: any, i: number) => i !== index);
        updateField('records', newRecords);
        updateField('count', newRecords.length);
        if (sl === 14) updateDays(newRecords);
      };

      const handleRecordChange = (index: number, field: string, value: string) => {
        const newRecords = [...records];
        newRecords[index] = { ...newRecords[index], [field]: value };
        updateField('records', newRecords);
        if (sl === 14 && (field === 'startDate' || field === 'endDate')) {
          updateDays(newRecords);
        }
      };

      return (
        <div className="category-field publications-section">
          <label style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase' }}>
            {sl === 13 ? 'Reviewer / Chair Details' :
             sl === 14 ? 'Organized Events Details' :
             sl === 15 ? 'Invited Talks Details' :
             sl === 16 ? 'Outside Institute Events Details' :
             sl === 17 ? 'Inside Institute Events Details' :
             'Industry Relations Details'}
          </label>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th style={{ border: '1px solid #333', padding: '8px' }}>#</th>
                  {sl === 13 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Activity Type (Reviewer/Chair)</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Conference/Journal Name</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Date</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Description</th>
                    </>
                  )}
                  {sl === 14 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Title</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Role</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Start Date</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>End Date</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Place</th>
                    </>
                  )}
                  {sl === 15 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Talk Title</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Organization</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Date</th>
                    </>
                  )}
                  {sl === 16 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Name</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Organization</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Start Date</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>End Date</th>
                    </>
                  )}
                  {sl === 17 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Name</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Department</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Start Date</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>End Date</th>
                    </>
                  )}
                  {sl === 18 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Industry Name</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Activity Type</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Date</th>
                      <th style={{ border: '1px solid #333', padding: '8px' }}>Description</th>
                    </>
                  )}
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>
                  {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr>
                    <td colSpan={isDraft ? 8 : 7} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No entries added. Click "+ Add Entry" below to start.
                    </td>
                  </tr>
                )}
                {records.map((rec: any, index: number) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>{index + 1}</td>
                    {sl === 13 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.activityType || ''} onChange={e => handleRecordChange(index, 'activityType', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.name || ''} onChange={e => handleRecordChange(index, 'name', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="date" value={rec.date || ''} onChange={e => handleRecordChange(index, 'date', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.description || ''} onChange={e => handleRecordChange(index, 'description', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                      </>
                    )}
                    {sl === 14 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.name || ''} onChange={e => handleRecordChange(index, 'name', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.role || ''} onChange={e => handleRecordChange(index, 'role', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="date" value={rec.startDate || ''} onChange={e => handleRecordChange(index, 'startDate', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="date" value={rec.endDate || ''} onChange={e => handleRecordChange(index, 'endDate', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.organization || ''} onChange={e => handleRecordChange(index, 'organization', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                      </>
                    )}
                    {sl === 15 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.name || ''} onChange={e => handleRecordChange(index, 'name', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.organization || ''} onChange={e => handleRecordChange(index, 'organization', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="date" value={rec.date || ''} onChange={e => handleRecordChange(index, 'date', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                      </>
                    )}
                    {sl === 16 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.name || ''} onChange={e => handleRecordChange(index, 'name', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.organization || ''} onChange={e => handleRecordChange(index, 'organization', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="date" value={rec.startDate || ''} onChange={e => handleRecordChange(index, 'startDate', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="date" value={rec.endDate || ''} onChange={e => handleRecordChange(index, 'endDate', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                      </>
                    )}
                    {sl === 17 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.name || ''} onChange={e => handleRecordChange(index, 'name', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.organization || ''} onChange={e => handleRecordChange(index, 'organization', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="date" value={rec.startDate || ''} onChange={e => handleRecordChange(index, 'startDate', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="date" value={rec.endDate || ''} onChange={e => handleRecordChange(index, 'endDate', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                      </>
                    )}
                    {sl === 18 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.name || ''} onChange={e => handleRecordChange(index, 'name', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.activityType || ''} onChange={e => handleRecordChange(index, 'activityType', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="date" value={rec.date || ''} onChange={e => handleRecordChange(index, 'date', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}><input type="text" value={rec.description || ''} onChange={e => handleRecordChange(index, 'description', e.target.value)} disabled={!isDraft} style={{ width: '100%', boxSizing: 'border-box' }} /></td>
                      </>
                    )}
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '150px' }}>
                      {(() => {
                        const doc = entry?.proof_documents?.find((d: any) => d.item_index === index);
                        if (doc) {
                          return (
                            <div className="category-docs">
                              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block', fontSize: '0.75rem', padding: '4px 8px' }}>
                                📄 {doc.file_name}
                              </a>
                              {isDraft && (
                                <button type="button" className="btn-small" style={{ display: 'block', marginTop: '4px', padding: '2px 4px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px' }} onClick={() => onRemoveProof(doc.id)}>
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          );
                        } else if (isDraft) {
                          return (
                            <FileUpload
                              onFileSelect={(file) => onUpload(file, index)}
                              uploading={uploading}
                              maxFiles={1}
                              uploadedFiles={[]}
                            />
                          );
                        } else {
                          return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No document</span>;
                        }
                      })()}
                    </td>
                    {isDraft && (
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        <button type="button" onClick={() => handleRemoveRecord(index)} style={{ padding: '4px 8px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDraft && (
            <button 
              type="button" 
              onClick={handleAddRecord} 
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                marginBottom: '1rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                display: 'block',
                width: '100%'
              }}
            >
              + Add Entry
            </button>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ textTransform: 'uppercase' }}>TOTAL ENTRIES/ACTIVITIES</label>
            <input
              type="number"
              value={localValues.count ?? 0}
              disabled={true}
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '100px', marginLeft: '10px' }}
            />
            {sl === 14 && (
              <>
                <label style={{ textTransform: 'uppercase', marginLeft: '1rem' }}>TOTAL DAYS</label>
                <input
                  type="number"
                  value={localValues.days ?? 0}
                  disabled={true}
                  style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '100px', marginLeft: '10px' }}
                />
              </>
            )}
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
              This is auto-calculated based on the table entries above.
            </small>
          </div>
        </div>
      );
    }

    // Category 19: Institutional/Departmental Services (role select + count)
    if (sl === 19) {
      const items = localValues.items || [];

      const handleAddItem = () => {
        const newItems = [...items, { description: '', level: 'Department' }];
        updateField('items', newItems);
        updateField('count', newItems.length);
      };

      const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_: any, i: number) => i !== index);
        updateField('items', newItems);
        updateField('count', newItems.length);
      };

      const handleItemChange = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        updateField('items', newItems);
      };

      return (
        <div className="category-field publications-section">
          <label style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Institutional/Departmental Services Details
          </label>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 'bold' }}>Primary Role (Applies to all entries for scoring)</label>
            <select
              value={localValues.role ?? ''}
              onChange={e => updateField('role', e.target.value)}
              disabled={!isDraft}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '0.5rem', maxWidth: '300px', display: 'block' }}
            >
              <option value="">Select role</option>
              <option value="coordinator">Coordinator</option>
              <option value="member">Member / Others</option>
            </select>
          </div>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Description / Responsibility</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Level</th>
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>
                  {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={isDraft ? 4 : 3} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No entries added. Click "+ Add Entry" below to start.
                    </td>
                  </tr>
                )}
                {items.map((item: any, index: number) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #333', padding: '8px' }}>
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={e => handleItemChange(index, 'description', e.target.value)}
                        disabled={!isDraft}
                        placeholder="e.g. Responsible for Placement Data"
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                      <select
                        value={item.level || 'Department'}
                        onChange={e => handleItemChange(index, 'level', e.target.value)}
                        disabled={!isDraft}
                        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                      >
                        <option value="Department">Department</option>
                        <option value="Institute">Institute</option>
                      </select>
                    </td>
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '150px', textAlign: 'center' }}>
                      {(() => {
                        const doc = entry?.proof_documents?.find((d: any) => d.item_index === index);
                        if (doc) {
                          return (
                            <div className="category-docs">
                              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block', fontSize: '0.75rem', padding: '4px 8px' }}>
                                📄 {doc.file_name}
                              </a>
                              {isDraft && (
                                <button type="button" className="btn-small" style={{ display: 'block', marginTop: '4px', padding: '2px 4px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', margin: '4px auto 0' }} onClick={() => onRemoveProof(doc.id)}>
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          );
                        } else if (isDraft) {
                          return (
                            <FileUpload
                              onFileSelect={(file) => onUpload(file, index)}
                              uploading={uploading}
                              maxFiles={1}
                              uploadedFiles={[]}
                            />
                          );
                        } else {
                          return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No document</span>;
                        }
                      })()}
                    </td>
                    {isDraft && (
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveItem(index)} 
                          style={{ 
                            padding: '4px 8px', 
                            backgroundColor: '#ff4d4f', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDraft && (
            <button 
              type="button" 
              onClick={handleAddItem} 
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              + Add Entry
            </button>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem' }}>Total Count:</label>
            <input
              type="number"
              value={localValues.count ?? 0}
              disabled={true}
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '80px', marginLeft: '0.5rem' }}
            />
          </div>
        </div>
      );
    }

    // Categories 20, 21, 22, 23 (Generic Tables)
    if (sl >= 20 && sl <= 23) {
      const items = localValues.items || [];

      const handleAddItem = () => {
        const newItem = sl === 20 ? { description: '', committee: '', duration: '' } :
                        sl === 21 ? { awardName: '', agency: '', year: '', level: 'State' } :
                        sl === 22 ? { activity: '', duration: '' } :
                        { description: '', role: '', duration: '' }; // sl 23
        const newItems = [...items, newItem];
        updateField('items', newItems);
        updateField('count', newItems.length);
      };

      const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_: any, i: number) => i !== index);
        updateField('items', newItems);
        updateField('count', newItems.length);
      };

      const handleItemChange = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        updateField('items', newItems);
      };

      const getTitle = () => {
        if (sl === 20) return 'Other Services Details';
        if (sl === 21) return 'Awards and Honours Details';
        if (sl === 22) return 'Professionalism / Team Spirit Details';
        return 'Any Other Major Contributions Details';
      };

      return (
        <div className="category-field publications-section">
          <label style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            {getTitle()}
          </label>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', border: '2px solid #333' }}>
              <thead style={{ backgroundColor: '#f1f5f9' }}>
                <tr>
                  {sl === 20 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Description / Contribution</th>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Committee / Activity Name</th>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Date / Duration</th>
                    </>
                  )}
                  {sl === 21 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Award Name</th>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Awarding Agency</th>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Year / Date</th>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Level</th>
                    </>
                  )}
                  {sl === 22 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Description of Activity</th>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Date / Duration</th>
                    </>
                  )}
                  {sl === 23 && (
                    <>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Contribution Description</th>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Role</th>
                      <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Date / Duration</th>
                    </>
                  )}
                  <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Document</th>
                  {isDraft && <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={isDraft ? 6 : 5} style={{ border: '1px solid #333', padding: '1rem', textAlign: 'center', color: '#666' }}>
                      No entries added. Click "+ Add Entry" below to start.
                    </td>
                  </tr>
                )}
                {items.map((item: any, index: number) => (
                  <tr key={index}>
                    {sl === 20 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input type="text" value={item.description || ''} onChange={e => handleItemChange(index, 'description', e.target.value)} disabled={!isDraft} placeholder="Description" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input type="text" value={item.committee || ''} onChange={e => handleItemChange(index, 'committee', e.target.value)} disabled={!isDraft} placeholder="Activity Name" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                          <input type="text" value={item.duration || ''} onChange={e => handleItemChange(index, 'duration', e.target.value)} disabled={!isDraft} placeholder="Date/Duration" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                      </>
                    )}
                    {sl === 21 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input type="text" value={item.awardName || ''} onChange={e => handleItemChange(index, 'awardName', e.target.value)} disabled={!isDraft} placeholder="Award Name" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input type="text" value={item.agency || ''} onChange={e => handleItemChange(index, 'agency', e.target.value)} disabled={!isDraft} placeholder="Agency" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '100px' }}>
                          <input type="text" value={item.year || ''} onChange={e => handleItemChange(index, 'year', e.target.value)} disabled={!isDraft} placeholder="Year/Date" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                          <select value={item.level || 'State'} onChange={e => handleItemChange(index, 'level', e.target.value)} disabled={!isDraft} style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}>
                            <option value="State">State</option>
                            <option value="National">National</option>
                            <option value="International">International</option>
                          </select>
                        </td>
                      </>
                    )}
                    {sl === 22 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input type="text" value={item.activity || ''} onChange={e => handleItemChange(index, 'activity', e.target.value)} disabled={!isDraft} placeholder="Activity Description" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                          <input type="text" value={item.duration || ''} onChange={e => handleItemChange(index, 'duration', e.target.value)} disabled={!isDraft} placeholder="Date/Duration" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                      </>
                    )}
                    {sl === 23 && (
                      <>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input type="text" value={item.description || ''} onChange={e => handleItemChange(index, 'description', e.target.value)} disabled={!isDraft} placeholder="Contribution Description" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>
                          <input type="text" value={item.role || ''} onChange={e => handleItemChange(index, 'role', e.target.value)} disabled={!isDraft} placeholder="Role" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', minWidth: '130px' }}>
                          <input type="text" value={item.duration || ''} onChange={e => handleItemChange(index, 'duration', e.target.value)} disabled={!isDraft} placeholder="Date/Duration" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </td>
                      </>
                    )}
                    <td style={{ border: '1px solid #333', padding: '8px', minWidth: '150px', textAlign: 'center' }}>
                      {(() => {
                        const doc = entry?.proof_documents?.find((d: any) => d.item_index === index);
                        if (doc) {
                          return (
                            <div className="category-docs">
                              <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block', fontSize: '0.75rem', padding: '4px 8px' }}>
                                📄 {doc.file_name}
                              </a>
                              {isDraft && (
                                <button type="button" className="btn-small" style={{ display: 'block', marginTop: '4px', padding: '2px 4px', background: '#fee2e2', color: '#ef4444', border: 'none', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', margin: '4px auto 0' }} onClick={() => onRemoveProof(doc.id)}>
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          );
                        } else if (isDraft) {
                          return (
                            <FileUpload
                              onFileSelect={(file) => onUpload(file, index)}
                              uploading={uploading}
                              maxFiles={1}
                              uploadedFiles={[]}
                            />
                          );
                        } else {
                          return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No document</span>;
                        }
                      })()}
                    </td>
                    {isDraft && (
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        <button type="button" onClick={() => handleRemoveItem(index)} style={{ padding: '4px 8px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDraft && (
            <button type="button" onClick={handleAddItem} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>
              + Add Entry
            </button>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem' }}>Total Count:</label>
            <input type="number" value={localValues.count ?? 0} disabled={true} style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', width: '80px', marginLeft: '0.5rem' }} />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="category-form-item">
      <div className="category-form-header">
        <span className="category-sl">{category.sl_no}</span>
        <div className="category-info">
          <h4>{category.name}</h4>
          {category.description && <p className="category-desc">{category.description}</p>}
        </div>
        {entry?.calculated_score !== null && entry?.calculated_score !== undefined && (
          <span className="category-score">Score: {Number(entry.calculated_score).toFixed(1)}</span>
        )}
      </div>

      <div className="category-form-body">
        {renderInput()}

        {(() => {
          const dynamicCount = 
            category.sl_no >= 2
              ? 0
              : (typeof localValues.count === 'number' ? localValues.count : 0) +
                (typeof localValues.books === 'number' ? localValues.books : 0) +
                (typeof localValues.chapters === 'number' ? localValues.chapters : 0);

          if (dynamicCount > 0) {
            return (
              <div className="dynamic-items-container" style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Detailed Information & Uploads</h4>
                {Array.from({ length: dynamicCount }).map((_, idx) => {
                  const doc = entry?.proof_documents?.find(d => d.item_index === idx);
                  return (
                    <div key={idx} className="dynamic-item-card" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                      <h5 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>Item #{idx + 1}</h5>
                      
                      <div className="category-field">
                        <label>Description / Details</label>
                        <textarea 
                          value={localValues[`item_desc_${idx}`] || ''}
                          onChange={e => updateField(`item_desc_${idx}`, e.target.value)}
                          disabled={!isDraft}
                          placeholder="Enter description or details for this item..."
                          rows={2}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                      
                      {isDraft && !doc && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <FileUpload
                            onFileSelect={(file) => onUpload(file, idx)}
                            uploading={uploading}
                            maxFiles={1}
                            uploadedFiles={[]}
                          />
                        </div>
                      )}

                      {doc && (
                        <div className="category-docs" style={{ marginTop: '0.5rem' }}>
                          <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block' }}>
                            📄 {doc.file_name}
                          </a>
                          {isDraft && (
                            <button className="btn-small" style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', background: '#fee2e2', color: '#ef4444', border: 'none' }} onClick={() => onRemoveProof(doc.id)}>
                              ✕ Remove
                            </button>
                          )}
                        </div>
                      )}
                      
                      {!isDraft && !doc && (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No document uploaded</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }

          // Display any existing generic documents (legacy data fallback)
          const fallbackDocs = entry?.proof_documents?.filter(d => d.item_index == null || d.item_index === undefined) || [];
          return (
            <>
              {fallbackDocs.length > 0 && (
                <div className="category-docs" style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>Legacy Documents</h4>
                  {fallbackDocs.map((doc: any) => (
                    <div key={doc.id} style={{ display: 'inline-flex', alignItems: 'center', marginRight: '0.5rem', marginBottom: '0.5rem' }}>
                      <a href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                        📄 {doc.file_name}
                      </a>
                      {isDraft && (
                        <button className="btn-small" style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', background: '#fee2e2', color: '#ef4444', border: 'none', cursor: 'pointer', borderRadius: '4px' }} onClick={() => onRemoveProof(doc.id)}>
                          ✕ Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {isDraft && (
        <div className="category-form-footer">
          <button className="btn-save" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? 'Saving...' : dirty ? '💾 Save' : '✓ Saved'}
          </button>
        </div>
      )}
    </div>
  );
}
