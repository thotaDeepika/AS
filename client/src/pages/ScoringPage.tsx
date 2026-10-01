import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import VisualJsonEditor from '../components/VisualJsonEditor';
import { CATEGORY_COLUMNS, type ColumnDef } from '../lib/constants';
import { DynamicColumnEditor } from '../components/DynamicColumnEditor';

interface Category {
  id: string;
  sl_no: number;
  section: string;
  name: string;
  description: string | null;
  input_type: string;
  input_config: any;
  is_active: boolean;
  scoring_rules: ScoringRule[];
}

interface ScoringRule {
  id: string;
  designation: string;
  max_weightage: string | number;
  formula: any;
}

const SECTIONS = ['TEACHING', 'RESEARCH', 'SERVICE'];
const sectionColors: Record<string, string> = {
  TEACHING: '#3b82f6',
  RESEARCH: '#8b5cf6',
  SERVICE: '#10b981',
};

export default function ScoringPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  };

  const loadCategories = async () => {
    try {
      const res = await adminApi.scoringCategories();
      setCategories(res.data.data.categories || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCatId(cat.id);
    setExpandedId(cat.id);
    setEditForm({
      name: cat.name,
      description: cat.description || '',
      is_active: cat.is_active,
      input_config: cat.input_config ? JSON.parse(JSON.stringify(cat.input_config)) : {},
      scoring_rules: cat.scoring_rules ? cat.scoring_rules.map(r => ({ 
        ...r,
        formula: r.formula ? JSON.parse(JSON.stringify(r.formula)) : {}
      })) : []
    });

    // Initialize mandatory_columns if missing for tabular categories
    setEditForm((prev: any) => {
      const config = { ...prev.input_config };
      if (CATEGORY_COLUMNS[cat.sl_no] && !config.mandatory_columns) {
        config.mandatory_columns = CATEGORY_COLUMNS[cat.sl_no].map(c => c.key);
      }
      return { ...prev, input_config: config };
    });
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCatId(null);
    setEditForm(null);
  };

  const handleSave = async (e: React.MouseEvent, catId: string) => {
    e.stopPropagation();
    
    setSaving(true);
    try {
      const payload = {
        name: editForm.name,
        description: editForm.description,
        is_active: editForm.is_active,
        input_config: editForm.input_config,
        scoring_rules: editForm.scoring_rules.map((r: any) => ({
          id: r.id,
          max_weightage: Number(r.max_weightage),
          formula: r.formula
        }))
      };
      await adminApi.updateScoringCategory(catId, payload);
      await loadCategories();
      setEditingCatId(null);
      setEditForm(null);
      showToast('success', 'Category updated successfully');
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  // Revert Single Category to Default
  const handleRevertSingleCategory = async (e: React.MouseEvent, cat: Category) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to revert Category SL #${cat.sl_no} (${cat.name}) to system default values? Custom rules and dynamic columns will be restored.`)) {
      return;
    }

    setReverting(true);
    try {
      const res = await adminApi.resetCategoryDefault(cat.id);
      await loadCategories();
      setEditingCatId(null);
      setEditForm(null);
      showToast('success', res.data.message || 'Category reverted to system default');
    } catch (err: any) {
      console.error(err);
      showToast('error', err.response?.data?.error || 'Failed to revert category to default');
    } finally {
      setReverting(false);
    }
  };

  // Revert All Categories to System Default
  const handleRevertAllDefaults = async () => {
    if (!window.confirm('⚠️ CRITICAL ACTION: Are you sure you want to revert ALL scoring categories, rules, and dynamic column configurations back to system defaults?\n\nThis will restore default legacy scoring rules for all 23 categories.')) {
      return;
    }

    setReverting(true);
    try {
      const res = await adminApi.resetAllScoringDefaults();
      await loadCategories();
      setEditingCatId(null);
      setEditForm(null);
      showToast('success', res.data.message || 'All scoring categories reverted to system defaults');
    } catch (err: any) {
      console.error(err);
      showToast('error', err.response?.data?.error || 'Failed to revert all scoring defaults');
    } finally {
      setReverting(false);
    }
  };

  // Field Level Reset in Edit Form
  const resetFormColumnsField = (sl_no: number) => {
    const defaultCols = CATEGORY_COLUMNS[sl_no] ? JSON.parse(JSON.stringify(CATEGORY_COLUMNS[sl_no])) : undefined;
    setEditForm((prev: any) => ({
      ...prev,
      input_config: {
        ...prev.input_config,
        columns: defaultCols
      }
    }));
    showToast('success', 'Columns reset to default configuration');
  };

  const filtered = selectedSection === 'ALL'
    ? categories
    : categories.filter(c => c.section === selectedSection);

  const sectionStats = SECTIONS.map(s => ({
    section: s,
    count: categories.filter(c => c.section === s).length,
    totalWeight: categories
      .filter(c => c.section === s)
      .reduce((sum, c) => {
        const maxRule = c.scoring_rules?.[0];
        return sum + (maxRule ? Number(maxRule.max_weightage) : 0);
      }, 0),
  }));

  if (loading) {
    return (
      <div className="scoring-page">
        <div className="page-loader-inline"><div className="loader-spinner" /><p>Loading scoring configuration...</p></div>
      </div>
    );
  }

  return (
    <div className="scoring-page" style={{ padding: '1.5rem', animation: 'fadeUp 0.4s ease' }}>
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* Header with Global Revert Option */}
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>⚙️ Scoring Configuration</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Configure category caps, dynamic columns, formulas, or revert fields to default</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleRevertAllDefaults}
            disabled={reverting}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #fca5a5',
              background: '#fee2e2',
              color: '#ef4444',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Revert ALL categories and rules to system defaults"
          >
            {reverting ? 'Reverting...' : '↺ Revert All to Defaults'}
          </button>
          <span className="config-badge" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem' }}>
            {categories.length} Categories
          </span>
        </div>
      </div>

      {/* Section Stats */}
      <div className="scoring-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {sectionStats.map(s => (
          <div
            key={s.section}
            className={`scoring-stat-card ${selectedSection === s.section ? 'selected' : ''}`}
            onClick={() => setSelectedSection(selectedSection === s.section ? 'ALL' : s.section)}
            style={{ '--stat-color': sectionColors[s.section], cursor: 'pointer' } as React.CSSProperties}
          >
            <div className="scoring-stat-header">
              <span className="scoring-stat-section">{s.section}</span>
              <span className="scoring-stat-count">{s.count} categories</span>
            </div>
            <span className="scoring-stat-weight">Max Weight: {s.totalWeight}</span>
          </div>
        ))}
      </div>

      {/* Category List */}
      <div className="scoring-categories-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {filtered.map(cat => (
          <div
            key={cat.id}
            className={`scoring-category-card ${expandedId === cat.id ? 'expanded' : ''}`}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}
          >
            <div className="scoring-cat-header" onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)} style={{ padding: '16px 20px', cursor: 'pointer' }}>
              <div className="scoring-cat-left" style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                <span className="scoring-cat-sl" style={{ background: sectionColors[cat.section], color: '#fff', padding: '6px 12px', borderRadius: '8px', fontWeight: 800 }}>{cat.sl_no}</span>
                <div className="scoring-cat-info" style={{ flex: 1 }}>
                  {editingCatId === cat.id ? (
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                      <input 
                        type="text" 
                        value={editForm.name} 
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                        className="form-input" 
                        style={{ width: '100%', fontSize: '1.1rem', fontWeight: 600, padding: '8px 12px' }}
                      />
                      <input 
                        type="text" 
                        value={editForm.description} 
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })} 
                        className="form-input" 
                        placeholder="Description (optional)"
                        style={{ width: '100%', fontSize: '0.9rem', padding: '6px 12px' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={editForm.is_active} 
                          onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                        />
                        Active Category
                      </label>
                    </div>
                  ) : (
                    <>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{cat.name}</h4>
                      {cat.description && <p className="scoring-cat-desc" style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{cat.description}</p>}
                    </>
                  )}
                </div>
              </div>
              <div className="scoring-cat-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <StatusBadge status={cat.section} size="sm" />
                <span className="scoring-cat-type" style={{ fontSize: '0.75rem', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border)' }}>{cat.input_type.replace(/_/g, ' ')}</span>
                
                {editingCatId === cat.id ? (
                  <div className="action-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-small" onClick={(e) => cancelEdit(e)} disabled={saving} style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>Cancel</button>
                    <button className="btn-small" onClick={(e) => handleSave(e, cat.id)} disabled={saving} style={{ background: '#3b82f6', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                ) : (
                  <>
                    <span className={`scoring-cat-active ${cat.is_active ? '' : 'inactive'}`} style={{ fontSize: '0.8rem', fontWeight: 600, color: cat.is_active ? '#10b981' : '#94a3b8' }}>
                      {cat.is_active ? '● Active' : '○ Inactive'}
                    </span>
                    <button className="btn-small" onClick={(e) => startEdit(cat, e)} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Edit</button>
                    <button
                      className="btn-small"
                      onClick={(e) => handleRevertSingleCategory(e, cat)}
                      disabled={reverting}
                      style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5' }}
                      title="Revert this category to system default"
                    >
                      ↺ Default
                    </button>
                    <span className="scoring-cat-chevron">{expandedId === cat.id ? '▼' : '▶'}</span>
                  </>
                )}
              </div>
            </div>

            {expandedId === cat.id && (
              <div className="scoring-cat-details" style={{ padding: '20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                {/* Input Config Section */}
                <div className="detail-section" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h5 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Input Configuration</h5>
                    {editingCatId === cat.id && CATEGORY_COLUMNS[cat.sl_no] && (
                      <button
                        type="button"
                        onClick={() => resetFormColumnsField(cat.sl_no)}
                        style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ↺ Reset Columns to Default
                      </button>
                    )}
                  </div>

                  {editingCatId === cat.id ? (
                    <div style={{ background: 'var(--bg-card)', padding: '16px', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {CATEGORY_COLUMNS[cat.sl_no] && (
                        <div>
                          <h6 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Dynamic Column Configuration</h6>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Add, edit, or remove columns. Customizes application inputs for this category.</p>
                          <DynamicColumnEditor
                            columns={editForm.input_config?.columns || CATEGORY_COLUMNS[cat.sl_no]}
                            onChange={(newCols) => {
                              setEditForm({
                                ...editForm,
                                input_config: { ...editForm.input_config, columns: newCols }
                              });
                            }}
                          />
                        </div>
                      )}
                      <div>
                        <h6 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Advanced JSON Config</h6>
                        <VisualJsonEditor 
                          data={editForm.input_config} 
                          onChange={(newData) => setEditForm({ ...editForm, input_config: newData })} 
                        />
                      </div>
                    </div>
                  ) : cat.input_config ? (
                    <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      {cat.input_config?.columns && (
                        <div style={{ marginBottom: '1rem' }}>
                          <h6 style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>Configured Columns</h6>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {cat.input_config.columns.map((col: ColumnDef) => (
                              <span key={col.key} style={{ background: col.is_mandatory ? 'rgba(59,130,246,0.1)' : 'var(--bg-elevated)', color: col.is_mandatory ? '#3b82f6' : 'var(--text-secondary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid var(--border)', fontWeight: 600 }}>
                                {col.label} {col.is_mandatory ? '(Req)' : '(Opt)'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <pre className="config-json" style={{ margin: 0, padding: '10px', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '0.8rem' }}>{JSON.stringify(cat.input_config, null, 2)}</pre>
                    </div>
                  ) : (
                    <p className="no-rules">No input configuration</p>
                  )}
                </div>

                {/* Scoring Rules Section */}
                <div className="detail-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h5 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Scoring Rules ({cat.scoring_rules?.length || 0})</h5>
                    <button
                      type="button"
                      onClick={(e) => handleRevertSingleCategory(e, cat)}
                      disabled={reverting}
                      style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      ↺ Revert Rules & Category to Default
                    </button>
                  </div>

                  {cat.scoring_rules?.length > 0 ? (
                    <div className="rules-table">
                      <div className="rules-header">
                        <span>Designation</span>
                        <span>Max Weightage</span>
                        <span>Formula</span>
                      </div>
                      {editingCatId === cat.id ? (
                        editForm.scoring_rules.map((rule: any, idx: number) => (
                          <div key={rule.id} className="rules-row" style={{ alignItems: 'center' }}>
                            <span className="rule-designation">{rule.designation.replace(/_/g, ' ')}</span>
                            <span>
                              <input 
                                type="number" 
                                value={rule.max_weightage} 
                                onChange={e => {
                                  const newRules = [...editForm.scoring_rules];
                                  newRules[idx].max_weightage = e.target.value;
                                  setEditForm({ ...editForm, scoring_rules: newRules });
                                }}
                                className="form-input" 
                                style={{ width: '80px', padding: '0.3rem' }}
                              />
                            </span>
                            <span style={{ flex: 1, background: 'var(--bg-card)', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}>
                              <VisualJsonEditor 
                                data={rule.formula} 
                                onChange={(newFormula) => {
                                  const newRules = [...editForm.scoring_rules];
                                  newRules[idx].formula = newFormula;
                                  setEditForm({ ...editForm, scoring_rules: newRules });
                                }} 
                              />
                            </span>
                          </div>
                        ))
                      ) : (
                        cat.scoring_rules.map(rule => (
                          <div key={rule.id} className="rules-row">
                            <span className="rule-designation">{rule.designation.replace(/_/g, ' ')}</span>
                            <span className="rule-weight">{Number(rule.max_weightage).toFixed(1)}</span>
                            <pre className="rule-formula">{JSON.stringify(rule.formula, null, 2)}</pre>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <p className="no-rules">No scoring rules configured for this category</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
