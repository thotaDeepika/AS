import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { applicationsApi } from '../lib/api';
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

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [scoreTotals, setScoreTotals] = useState<any>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('TEACHING');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Get form values from application entries
  const getEntryValue = useCallback((categoryId: string, field: string): any => {
    const entry = application?.category_entries.find(e => e.category_id === categoryId);
    return entry?.raw_value?.[field] ?? '';
  }, [application]);

  // Load categories + application
  useEffect(() => {
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

        if (apps.length > 0) {
          const detail = await applicationsApi.getById(apps[0].id);
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
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to create application');
    } finally {
      setCreating(false);
    }
  };

  // Save a category entry
  const handleSaveEntry = async (categoryId: string, rawValue: Record<string, any>) => {
    if (!application || application.status !== 'DRAFT') return;
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
  const handleUpload = async (categoryId: string, file: File) => {
    if (!application) return;
    setUploading(prev => ({ ...prev, [categoryId]: true }));
    try {
      await applicationsApi.uploadProof(application.id, categoryId, file);
      const detail = await applicationsApi.getById(application.id);
      setApplication(detail.data.data.application);
      showToast('success', 'Document uploaded');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Upload failed');
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
    if (!application || application.status !== 'DRAFT') return;
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

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  if (loading) return <div className="page-loader"><div className="loader-spinner" /><p>Loading...</p></div>;

  // Faculty role: if no application, show create card
  if (user?.role === 'FACULTY' && !application) {
    return (
      <div className="app-empty-state">
        <div className="empty-icon">📝</div>
        <h2>No Application Found</h2>
        <p>Start your appraisal by creating a new application for the current academic year.</p>
        <button className="btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating...' : `Create Application (${academicYear})`}
        </button>
      </div>
    );
  }

  if (!application) return null;

  const isDraft = application.status === 'DRAFT';
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

      {/* Application Header */}
      <div className="app-header-card">
        <div className="app-header-info">
          <div className="app-header-top">
            <h2>Appraisal Application</h2>
            <StatusBadge status={application.status} />
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
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : '🚀 Submit Application'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Score Overview */}
      {(scoreTotals || application.total_score !== null) && (
        <div className="score-overview">
          <ScoreCard label="Teaching" score={scoreTotals?.teaching ?? 0} maxScore={60} color="#3b82f6" size="sm" />
          <ScoreCard label="Research" score={scoreTotals?.research ?? 0} maxScore={30} color="#8b5cf6" size="sm" />
          <ScoreCard label="Service" score={scoreTotals?.service ?? 0} maxScore={30} color="#10b981" size="sm" />
          <ScoreCard label="Total Score" score={scoreTotals?.total ?? application.total_score ?? 0} maxScore={100} color="#f59e0b" />
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
                  onUpload={(file) => handleUpload(cat.id, file)}
                  getEntryValue={(field) => getEntryValue(cat.id, field)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Review History */}
      {application.reviews.length > 0 && (
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
  onUpload: (file: File) => void;
  getEntryValue: (field: string) => any;
}

function CategoryFormItem({ category, entry, isDraft, saving, uploading, onSave, onUpload, getEntryValue }: CategoryFormItemProps) {
  const [localValues, setLocalValues] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);

  // Initialize from entry
  useEffect(() => {
    if (entry?.raw_value) {
      setLocalValues(entry.raw_value);
    }
  }, [entry]);

  const updateField = (field: string, value: any) => {
    setLocalValues(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(localValues);
    setDirty(false);
  };

  // Generate input fields based on category
  const renderInput = () => {
    const sl = category.sl_no;

    // Category 1: FCI Score
    if (sl === 1) {
      return (
        <div className="category-field">
          <label>Average FCI Score (%)</label>
          <input
            type="number"
            min="0" max="100" step="0.1"
            value={localValues.fci_percentage ?? ''}
            onChange={e => updateField('fci_percentage', parseFloat(e.target.value) || 0)}
            disabled={!isDraft}
            placeholder="e.g. 82.5"
          />
        </div>
      );
    }

    // Categories 2-4: Paper counts
    if (sl >= 2 && sl <= 4) {
      return (
        <div className="category-field">
          <label>Number of Papers/Publications</label>
          <input
            type="number"
            min="0"
            value={localValues.count ?? ''}
            onChange={e => updateField('count', parseInt(e.target.value) || 0)}
            disabled={!isDraft}
            placeholder="e.g. 2"
          />
        </div>
      );
    }

    // Category 5: Books/Chapters
    if (sl === 5) {
      return (
        <div className="category-fields-row">
          <div className="category-field">
            <label>Books Authored</label>
            <input
              type="number" min="0"
              value={localValues.books ?? ''}
              onChange={e => updateField('books', parseInt(e.target.value) || 0)}
              disabled={!isDraft} placeholder="0"
            />
          </div>
          <div className="category-field">
            <label>Book Chapters</label>
            <input
              type="number" min="0"
              value={localValues.chapters ?? ''}
              onChange={e => updateField('chapters', parseInt(e.target.value) || 0)}
              disabled={!isDraft} placeholder="0"
            />
          </div>
        </div>
      );
    }

    // Categories 6-7: Disclosures/Patents
    if (sl === 6 || sl === 7) {
      return (
        <div className="category-field">
          <label>Count</label>
          <input
            type="number" min="0"
            value={localValues.count ?? ''}
            onChange={e => updateField('count', parseInt(e.target.value) || 0)}
            disabled={!isDraft} placeholder="0"
          />
        </div>
      );
    }

    // Categories 8-10: Research Guidance
    if (sl >= 8 && sl <= 10) {
      return (
        <div className="category-field">
          <label>Number of Batches/Students</label>
          <input
            type="number" min="0"
            value={localValues.count ?? ''}
            onChange={e => updateField('count', parseInt(e.target.value) || 0)}
            disabled={!isDraft} placeholder="0"
          />
        </div>
      );
    }

    // Categories 11-12: Funded/Consulting Projects
    if (sl === 11 || sl === 12) {
      return (
        <div className="category-field">
          <label>Total Funding Amount (in Lakhs)</label>
          <input
            type="number" min="0" step="0.01"
            value={localValues.funding_lakhs ?? ''}
            onChange={e => updateField('funding_lakhs', parseFloat(e.target.value) || 0)}
            disabled={!isDraft} placeholder="e.g. 5.5"
          />
        </div>
      );
    }

    // Category 14: FDP organized (has days)
    if (sl === 14) {
      return (
        <div className="category-field">
          <label>Number of Days</label>
          <input
            type="number" min="0"
            value={localValues.days ?? ''}
            onChange={e => updateField('days', parseInt(e.target.value) || 0)}
            disabled={!isDraft} placeholder="e.g. 5"
          />
        </div>
      );
    }

    // Category 19: Institutional Services
    if (sl === 19) {
      return (
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
      );
    }

    // Category 23: Free text
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
          onChange={e => updateField('count', parseInt(e.target.value) || 0)}
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

        {/* Proof upload */}
        {isDraft && (
          <div className="category-upload">
            <FileUpload
              onFileSelect={(file) => onUpload(file)}
              uploading={uploading}
              uploadedFile={entry?.proof_documents?.[0] ? {
                name: entry.proof_documents[0].file_name,
                size: entry.proof_documents[0].file_size,
              } : null}
            />
          </div>
        )}

        {!isDraft && entry?.proof_documents && entry.proof_documents.length > 0 && (
          <div className="category-docs">
            {entry.proof_documents.map((doc: any) => (
              <div key={doc.id} className="doc-chip">📄 {doc.file_name}</div>
            ))}
          </div>
        )}
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
