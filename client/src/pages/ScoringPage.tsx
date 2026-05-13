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
                <div className="scoring-cat-info">
                  <h4>{cat.name}</h4>
                  {cat.description && <p className="scoring-cat-desc">{cat.description}</p>}
                </div>
              </div>
              <div className="scoring-cat-right">
                <StatusBadge status={cat.section} size="sm" />
                <span className="scoring-cat-type">{cat.input_type.replace(/_/g, ' ')}</span>
                <span className={`scoring-cat-active ${cat.is_active ? '' : 'inactive'}`}>
                  {cat.is_active ? '● Active' : '○ Inactive'}
                </span>
                <span className="scoring-cat-chevron">{expandedId === cat.id ? '▼' : '▶'}</span>
              </div>
            </div>

            {expandedId === cat.id && (
              <div className="scoring-cat-details">
                {/* Input Config */}
                {cat.input_config && (
                  <div className="detail-section">
                    <h5>Input Configuration</h5>
                    <pre className="config-json">{JSON.stringify(cat.input_config, null, 2)}</pre>
                  </div>
                )}

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
                      {cat.scoring_rules.map(rule => (
                        <div key={rule.id} className="rules-row">
                          <span className="rule-designation">{rule.designation.replace(/_/g, ' ')}</span>
                          <span className="rule-weight">{Number(rule.max_weightage).toFixed(1)}</span>
                          <pre className="rule-formula">{JSON.stringify(rule.formula, null, 2)}</pre>
                        </div>
                      ))}
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
