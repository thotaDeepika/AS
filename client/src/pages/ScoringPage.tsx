import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import StatusBadge from '../components/StatusBadge';

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

  useEffect(() => {
    loadCategories();
  }, []);

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
      input_config_str: cat.input_config ? JSON.stringify(cat.input_config, null, 2) : '',
      scoring_rules: cat.scoring_rules ? cat.scoring_rules.map(r => ({ 
        ...r,
        formula_str: r.formula ? JSON.stringify(r.formula, null, 2) : ''
      })) : []
    });
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCatId(null);
    setEditForm(null);
  };

  const handleSave = async (e: React.MouseEvent, catId: string) => {
    e.stopPropagation();
    
    let parsedInputConfig = null;
    try {
      if (editForm.input_config_str?.trim()) {
        parsedInputConfig = JSON.parse(editForm.input_config_str);
      }
    } catch (err) {
      alert('Invalid JSON in Input Configuration. Please fix it and try again.');
      return;
    }

    const payloadRules = [];
    for (const r of editForm.scoring_rules) {
      let parsedFormula = null;
      try {
        if (r.formula_str?.trim()) {
          parsedFormula = JSON.parse(r.formula_str);
        }
      } catch (err) {
        alert(`Invalid JSON in Formula for ${r.designation}. Please fix it and try again.`);
        return;
      }
      payloadRules.push({
        id: r.id,
        max_weightage: Number(r.max_weightage),
        formula: parsedFormula
      });
    }

    setSaving(true);
    try {
      const payload = {
        name: editForm.name,
        description: editForm.description,
        is_active: editForm.is_active,
        input_config: parsedInputConfig,
        scoring_rules: payloadRules
      };
      await adminApi.updateScoringCategory(catId, payload);
      await loadCategories();
      setEditingCatId(null);
      setEditForm(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save category');
    } finally {
      setSaving(false);
    }
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
    <div className="scoring-page">
      <div className="page-title">
        <div>
          <h2>Scoring Configuration</h2>
          <p>View and manage appraisal categories, scoring rules, and weightage</p>
        </div>
        <span className="config-badge">{categories.length} Categories</span>
      </div>

      {/* Section Stats */}
      <div className="scoring-stats">
        {sectionStats.map(s => (
          <div
            key={s.section}
            className={`scoring-stat-card ${selectedSection === s.section ? 'selected' : ''}`}
            onClick={() => setSelectedSection(selectedSection === s.section ? 'ALL' : s.section)}
            style={{ '--stat-color': sectionColors[s.section] } as React.CSSProperties}
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
      <div className="scoring-categories-list">
        {filtered.map(cat => (
          <div
            key={cat.id}
            className={`scoring-category-card ${expandedId === cat.id ? 'expanded' : ''}`}
          >
            <div className="scoring-cat-header" onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}>
              <div className="scoring-cat-left">
                <span className="scoring-cat-sl" style={{ background: sectionColors[cat.section] }}>{cat.sl_no}</span>
                <div className="scoring-cat-info" style={{ flex: 1 }}>
                  {editingCatId === cat.id ? (
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                      <input 
                        type="text" 
                        value={editForm.name} 
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                        className="form-input" 
                        style={{ width: '100%', fontSize: '1.1rem', fontWeight: 600 }}
                      />
                      <input 
                        type="text" 
                        value={editForm.description} 
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })} 
                        className="form-input" 
                        placeholder="Description (optional)"
                        style={{ width: '100%', fontSize: '0.9rem' }}
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
                      <h4>{cat.name}</h4>
                      {cat.description && <p className="scoring-cat-desc">{cat.description}</p>}
                    </>
                  )}
                </div>
              </div>
              <div className="scoring-cat-right">
                <StatusBadge status={cat.section} size="sm" />
                <span className="scoring-cat-type">{cat.input_type.replace(/_/g, ' ')}</span>
                
                {editingCatId === cat.id ? (
                  <div className="action-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-small" onClick={(e) => cancelEdit(e)} disabled={saving} style={{ background: '#e2e8f0', color: '#475569' }}>Cancel</button>
                    <button className="btn-small" onClick={(e) => handleSave(e, cat.id)} disabled={saving} style={{ background: '#3b82f6', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                ) : (
                  <>
                    <span className={`scoring-cat-active ${cat.is_active ? '' : 'inactive'}`}>
                      {cat.is_active ? '● Active' : '○ Inactive'}
                    </span>
                    <button className="btn-small" onClick={(e) => startEdit(cat, e)} style={{ marginLeft: '1rem', background: '#f1f5f9', color: '#475569' }}>Edit</button>
                    <span className="scoring-cat-chevron" style={{ marginLeft: '1rem' }}>{expandedId === cat.id ? '▼' : '▶'}</span>
                  </>
                )}
              </div>
            </div>

            {expandedId === cat.id && (
              <div className="scoring-cat-details">
                {/* Input Config */}
                <div className="detail-section">
                  <h5>Input Configuration</h5>
                  {editingCatId === cat.id ? (
                    <textarea 
                      value={editForm.input_config_str} 
                      onChange={e => setEditForm({ ...editForm, input_config_str: e.target.value })}
                      className="form-input"
                      rows={5}
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.9rem', padding: '0.5rem' }}
                      placeholder="{}"
                    />
                  ) : (
                    cat.input_config ? (
                      <pre className="config-json">{JSON.stringify(cat.input_config, null, 2)}</pre>
                    ) : (
                      <p className="no-rules">No input configuration</p>
                    )
                  )}
                </div>

                {/* Scoring Rules */}
                <div className="detail-section">
                  <h5>Scoring Rules ({cat.scoring_rules?.length || 0})</h5>
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
                            <span style={{ flex: 1 }}>
                              <textarea 
                                value={rule.formula_str} 
                                onChange={e => {
                                  const newRules = [...editForm.scoring_rules];
                                  newRules[idx].formula_str = e.target.value;
                                  setEditForm({ ...editForm, scoring_rules: newRules });
                                }}
                                className="form-input" 
                                rows={3}
                                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: '0.4rem', opacity: 0.9 }}
                                placeholder="{}"
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
