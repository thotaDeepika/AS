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
    setTimeout(() => setToast(null), 4000);
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
      return (
        <div className="category-field">
          <label>Average FCI Score (%)</label>
          <input
            type="number"
            min="0" max="100" step="0.1"
            value={localValues.fci_percentage ?? ''}
            onChange={e => updateField('fci_percentage', e.target.value === '' ? '' : parseFloat(e.target.value))}
            disabled={!isDraft}
            placeholder="e.g. 82.5"
          />
        </div>
      );
    }

    // ── RESEARCH ──

    // Categories 2-4: Paper/Publication counts
    if (sl >= 2 && sl <= 4) {
      return (
        <div className="category-field">
          <label>Number of Papers/Publications</label>
          <input
            type="number" min="0"
            value={localValues.count ?? ''}
            onChange={e => updateField('count', e.target.value === '' ? '' : parseInt(e.target.value))}
            disabled={!isDraft}
            placeholder="e.g. 2"
          />
        </div>
      );
    }

    // Category 5: Books/Chapters (composite)
    if (sl === 5) {
      return (
        <div className="category-fields-row">
          <div className="category-field">
            <label>Books Authored</label>
            <input
              type="number" min="0"
              value={localValues.books ?? ''}
              onChange={e => updateField('books', e.target.value === '' ? '' : parseInt(e.target.value))}
              disabled={!isDraft} placeholder="0"
            />
          </div>
          <div className="category-field">
            <label>Book Chapters</label>
            <input
              type="number" min="0"
              value={localValues.chapters ?? ''}
              onChange={e => updateField('chapters', e.target.value === '' ? '' : parseInt(e.target.value))}
              disabled={!isDraft} placeholder="0"
            />
          </div>
        </div>
      );
    }

    // Categories 6-7: Disclosures Filed / Patents Granted
    if (sl === 6 || sl === 7) {
      return (
        <div className="category-field">
          <label>Count</label>
          <input
            type="number" min="0"
            value={localValues.count ?? ''}
            onChange={e => updateField('count', e.target.value === '' ? '' : parseInt(e.target.value))}
            disabled={!isDraft} placeholder="0"
          />
        </div>
      );
    }

    // Categories 8-10: Research Guidance (UG/PG/PhD)
    if (sl >= 8 && sl <= 10) {
      return (
        <div className="category-field">
          <label>Number of Batches/Students</label>
          <input
            type="number" min="0"
            value={localValues.count ?? ''}
            onChange={e => updateField('count', e.target.value === '' ? '' : parseInt(e.target.value))}
            disabled={!isDraft} placeholder="0"
          />
        </div>
      );
    }

    // Categories 11-12: Funded/Consulting Projects (currency slab)
    if (sl === 11 || sl === 12) {
      return (
        <div className="category-field">
          <label>Total Funding Amount (in Lakhs ₹)</label>
          <input
            type="number" min="0" step="0.01"
            value={localValues.amount_lakhs ?? ''}
            onChange={e => updateField('amount_lakhs', e.target.value === '' ? '' : parseFloat(e.target.value))}
            disabled={!isDraft} placeholder="e.g. 5.5"
          />
        </div>
      );
    }

    // ── SERVICE ──

    // Category 14: FDP/Seminar/Workshop organized (days slab)
    if (sl === 14) {
      return (
        <div className="category-field">
          <label>Number of Days</label>
          <input
            type="number" min="0"
            value={localValues.days ?? ''}
            onChange={e => updateField('days', e.target.value === '' ? '' : parseInt(e.target.value))}
            disabled={!isDraft} placeholder="e.g. 5"
          />
        </div>
      );
    }

    // Category 19: Institutional/Departmental Services (role select + count)
    if (sl === 19) {
      return (
        <div className="category-fields-row">
          <div className="category-field">
            <label>Role</label>
            <select
              value={localValues.role ?? ''}
              onChange={e => updateField('role', e.target.value)}
              disabled={!isDraft}
            >
              <option value="">Select role</option>
              <option value="coordinator">Coordinator</option>
              <option value="member">Member / Others</option>
            </select>
          </div>
          <div className="category-field">
            <label>Count / Number of Activities</label>
            <input
              type="number" min="0"
              value={localValues.count ?? ''}
              onChange={e => updateField('count', e.target.value === '' ? '' : parseInt(e.target.value))}
              disabled={!isDraft} placeholder="0"
            />
          </div>
        </div>
      );
    }

    // Category 23: Free text (any other contributions)
    if (sl === 23) {
      return (
        <div className="category-field">
          <label>Description (max 500 characters)</label>
          <textarea
            value={localValues.description ?? ''}
            onChange={e => updateField('description', e.target.value.slice(0, 500))}
            disabled={!isDraft}
            placeholder="Describe your contribution..."
            maxLength={500}
            rows={3}
          />
          <span className="char-count">{(localValues.description || '').length}/500</span>
        </div>
      );
    }

    // Default: count-based input (categories 13, 15-18, 20-22)
    return (
      <div className="category-field">
        <label>Count / Number of Activities</label>
        <input
          type="number" min="0"
          value={localValues.count ?? ''}
          onChange={e => updateField('count', e.target.value === '' ? '' : parseInt(e.target.value))}
          disabled={!isDraft} placeholder="0"
        />
      </div>
    );
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
            (typeof localValues.count === 'number' ? localValues.count : 0) +
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

          // Fallback generic upload (for categories without count)
          const fallbackDocs = entry?.proof_documents?.filter(d => d.item_index == null || d.item_index === undefined) || [];
          return (
            <>
              {isDraft && (
                <div className="category-upload">
                  <FileUpload
                    onFileSelect={(file) => onUpload(file)}
                    uploading={uploading}
                    maxFiles={maxAttachments}
                    uploadedFiles={
                      fallbackDocs.map((doc: any) => ({
                        id: doc.id,
                        name: doc.file_name,
                        size: doc.file_size,
                        url: getFileUrl(doc.file_path)
                      }))
                    }
                    onRemove={(idx) => onRemoveProof(fallbackDocs[idx].id)}
                  />
                </div>
              )}

              {!isDraft && fallbackDocs.length > 0 && (
                <div className="category-docs">
                  {fallbackDocs.map((doc: any) => (
                    <a key={doc.id} href={getFileUrl(doc.file_path)} target="_blank" rel="noreferrer" className="doc-chip" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                      📄 {doc.file_name}
                    </a>
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
