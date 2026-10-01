import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyticsApi } from '../lib/api';
import ScoreCard from '../components/ScoreCard';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Filter States
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedDesignation, setSelectedDesignation] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Auto Refresh States
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Active Tab for chart view switching
  const [activeChartTab, setActiveChartTab] = useState<'donut' | 'departments' | 'stacked' | 'spline' | 'gauge'>('donut');

  // Trigger fetch whenever filters change
  useEffect(() => {
    fetchAnalytics();
    setSecondsUntilRefresh(60);
  }, [selectedYear, selectedDept, selectedDesignation, selectedStatus]);

  // Auto refresh timer effect (refreshes every 60 seconds when enabled)
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const timer = setInterval(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) {
          fetchAnalytics();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled, selectedYear, selectedDept, selectedDesignation, selectedStatus]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedYear !== 'ALL') params.academic_year = selectedYear;
      if (selectedDept !== 'ALL') params.department_id = selectedDept;
      if (selectedDesignation !== 'ALL') params.designation = selectedDesignation;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;

      const res = await analyticsApi.dashboard(params);
      setData(res.data.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedYear('ALL');
    setSelectedDept('ALL');
    setSelectedDesignation('ALL');
    setSelectedStatus('ALL');
  };

  const isHod = user?.role === 'HOD';
  const isPrincipalOrAdmin = user?.role === 'PRINCIPAL' || user?.role === 'ADMIN';

  const summary = data?.summary || {};
  const filters = data?.filters || {};
  const distribution = data?.scoreDistribution || [];
  const deptComparison = data?.departmentComparison || [];
  const desigComparison = data?.designationComparison || [];
  const yoyTrend = data?.yearOverYearTrend || [];
  const topPerformers = data?.topPerformers || [];

  const totalApps = summary.totalApplications || 0;
  const isFiltered = selectedYear !== 'ALL' || selectedDept !== 'ALL' || selectedDesignation !== 'ALL' || selectedStatus !== 'ALL';

  // Donut chart calculations
  const circumference = 2 * Math.PI * 70; // r = 70 -> ~439.82
  let accumulatedOffset = 0;

  return (
    <div className="analytics-page" style={{ padding: '1.5rem', animation: 'fadeUp 0.4s ease' }}>
      {/* Page Header */}
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📈</span> Institutional Analytics & Visual Charts
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {isHod ? `Departmental Insights & Performance Trends for ${user?.name}` : 'Executive Appraisal Analytics, Department Comparison & Growth Trajectories'}
          </p>
        </div>

        {/* Refresh & Auto-Refresh Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            style={{
              background: autoRefreshEnabled ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-elevated)',
              color: autoRefreshEnabled ? '#10b981' : 'var(--text-muted)',
              border: `1px solid ${autoRefreshEnabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`,
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: autoRefreshEnabled ? '#10b981' : '#94a3b8', display: 'inline-block' }} />
            {autoRefreshEnabled ? `Auto Refresh ON (${secondsUntilRefresh}s)` : 'Auto Refresh OFF'}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={(e) => { e.preventDefault(); fetchAnalytics(); setSecondsUntilRefresh(60); }}
            disabled={loading}
            style={{ fontSize: '0.85rem' }}
          >
            🔄 Refresh Now
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="filter-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🔍 Filters:</span>
          {isFiltered && (
            <span style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
              Active Filters
            </span>
          )}
        </div>

        {/* Academic Year Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Academic Year</label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: selectedYear !== 'ALL' ? 700 : 400 }}
          >
            <option value="ALL">All Academic Years</option>
            {filters.availableYears?.map((y: string) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Department</label>
          {isHod ? (
            <div style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔒 {filters.availableDepartments?.[0]?.name || 'My Department'}
            </div>
          ) : (
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: selectedDept !== 'ALL' ? 700 : 400 }}
            >
              <option value="ALL">All Departments</option>
              {filters.availableDepartments?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          )}
        </div>

        {/* Designation Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Designation</label>
          <select
            value={selectedDesignation}
            onChange={e => setSelectedDesignation(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: selectedDesignation !== 'ALL' ? 700 : 400 }}
          >
            <option value="ALL">All Designations</option>
            <option value="ASSISTANT_PROFESSOR">Assistant Professor</option>
            <option value="ASSOCIATE_PROFESSOR">Associate Professor</option>
            <option value="PROFESSOR">Professor</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status</label>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: selectedStatus !== 'ALL' ? 700 : 400 }}
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="IN_REVIEW">In Review (HOD / Peer)</option>
            <option value="REVIEWER_REVIEWED">Reviewer Reviewed</option>
            <option value="APPROVED">Approved / Finalized</option>
            <option value="FROZEN">Frozen</option>
            <option value="SENT_TO_ACCOUNTS">Sent to Accounts</option>
          </select>
        </div>

        {/* Prominent Reset Filters Option */}
        {isFiltered && (
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              marginTop: 'auto',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #fca5a5',
              background: '#fee2e2',
              color: '#ef4444',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ↺ Reset Filters
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {loading ? (
        <div className="page-loader-inline" style={{ padding: '40px', textAlign: 'center' }}><div className="loader-spinner" /><p>Filtering appraisal metrics & rendering visual charts...</p></div>
      ) : (
        <>
          {/* Key Summary Cards */}
          <div className="score-overview" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <ScoreCard label="Submissions" score={summary.totalApplications || 0} color="#6366f1" size="sm" />
            <ScoreCard label="Avg Teaching" score={summary.avgTeaching || 0} color="#3b82f6" size="sm" />
            <ScoreCard label="Avg Research" score={summary.avgResearch || 0} color="#8b5cf6" size="sm" />
            <ScoreCard label="Avg Service" score={summary.avgService || 0} color="#10b981" size="sm" />
            <ScoreCard label="Avg Total Score" score={summary.avgTotalScore || 0} color="#f59e0b" />
            <ScoreCard label="* Avg Bonus" score={summary.avgBonusScore || 0} color="#ec4899" />
            <ScoreCard label="Avg Final Score" score={summary.avgFinalScore || 0} color="#10b981" />
          </div>

          {/* Premium Chart Type Switcher */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setActiveChartTab('donut'); }}
              style={{
                padding: '10px 18px',
                borderRadius: '8px 8px 0 0',
                border: '1px solid var(--border)',
                borderBottom: activeChartTab === 'donut' ? '3px solid #6366f1' : 'none',
                background: activeChartTab === 'donut' ? 'var(--bg-card)' : 'var(--bg-elevated)',
                color: activeChartTab === 'donut' ? '#6366f1' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🍩 Donut Distribution Chart
            </button>

            {isPrincipalOrAdmin && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setActiveChartTab('departments'); }}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px 8px 0 0',
                  border: '1px solid var(--border)',
                  borderBottom: activeChartTab === 'departments' ? '3px solid #6366f1' : 'none',
                  background: activeChartTab === 'departments' ? 'var(--bg-card)' : 'var(--bg-elevated)',
                  color: activeChartTab === 'departments' ? '#6366f1' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                📊 Department Column Comparison
              </button>
            )}

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setActiveChartTab('stacked'); }}
              style={{
                padding: '10px 18px',
                borderRadius: '8px 8px 0 0',
                border: '1px solid var(--border)',
                borderBottom: activeChartTab === 'stacked' ? '3px solid #6366f1' : 'none',
                background: activeChartTab === 'stacked' ? 'var(--bg-card)' : 'var(--bg-elevated)',
                color: activeChartTab === 'stacked' ? '#6366f1' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🥞 Stacked Cadre Breakdown
            </button>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setActiveChartTab('spline'); }}
              style={{
                padding: '10px 18px',
                borderRadius: '8px 8px 0 0',
                border: '1px solid var(--border)',
                borderBottom: activeChartTab === 'spline' ? '3px solid #6366f1' : 'none',
                background: activeChartTab === 'spline' ? 'var(--bg-card)' : 'var(--bg-elevated)',
                color: activeChartTab === 'spline' ? '#6366f1' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              📉 Smooth Spline Area Trend
            </button>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setActiveChartTab('gauge'); }}
              style={{
                padding: '10px 18px',
                borderRadius: '8px 8px 0 0',
                border: '1px solid var(--border)',
                borderBottom: activeChartTab === 'gauge' ? '3px solid #6366f1' : 'none',
                background: activeChartTab === 'gauge' ? 'var(--bg-card)' : 'var(--bg-elevated)',
                color: activeChartTab === 'gauge' ? '#6366f1' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🎯 Target Compliance Gauges
            </button>
          </div>

          {/* ========================================================================= */}
          {/* CHART 1: MODERN SVG DONUT / RING PIE CHART */}
          {/* ========================================================================= */}
          {activeChartTab === 'donut' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>🍩 Score Distribution Donut Chart</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Proportional ring breakdown of faculty scoring brackets for selected filters</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                {/* SVG Ring Donut */}
                <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                  <svg width="220" height="220" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="70" fill="none" stroke="var(--bg-elevated)" strokeWidth="24" />
                    {distribution.map((item: any) => {
                      if (item.count === 0 || totalApps === 0) return null;
                      const fraction = item.count / totalApps;
                      const strokeDasharray = `${fraction * circumference} ${circumference}`;
                      const strokeDashoffset = -accumulatedOffset;
                      accumulatedOffset += fraction * circumference;

                      return (
                        <circle
                          key={item.band}
                          cx="100"
                          cy="100"
                          r="70"
                          fill="none"
                          stroke={item.color}
                          strokeWidth="24"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          transform="rotate(-90 100 100)"
                          style={{ transition: 'all 0.6s ease' }}
                        />
                      );
                    })}
                  </svg>
                  {/* Center Text Badge */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{totalApps}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' }}>Submissions</div>
                  </div>
                </div>

                {/* Donut Legend & List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {distribution.map((item: any) => {
                    const pct = totalApps > 0 ? ((item.count / totalApps) * 100).toFixed(1) : '0';
                    return (
                      <div key={item.band} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.band} pts</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: item.color }}>{item.count} Faculty</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border)' }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CHART 2: GROUPED VERTICAL COLUMN CHART WITH BASELINES */}
          {/* ========================================================================= */}
          {activeChartTab === 'departments' && isPrincipalOrAdmin && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>📊 Department Performance Column Comparison</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Multi-metric vertical columns comparing Teaching, Research, Service, and Bonus averages</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                  <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>■ Teaching</span>
                  <span style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '4px' }}>■ Research</span>
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>■ Service</span>
                  <span style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: '4px' }}>■ * Bonus</span>
                </div>
              </div>

              {deptComparison.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No department comparison data available for active filters</p>
              ) : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <svg viewBox={`0 0 ${Math.max(deptComparison.length * 160, 600)} 260`} style={{ width: '100%', height: '260px', background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px' }}>
                    {[0, 20, 40, 60, 80, 100].map(s => {
                      const y = 200 - (s * 1.6);
                      return (
                        <g key={s}>
                          <line x1="30" y1={y} x2={Math.max(deptComparison.length * 160, 600)} y2={y} stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
                          <text x="10" y={y + 4} fill="var(--text-muted)" fontSize="9" fontWeight="600">{s}</text>
                        </g>
                      );
                    })}

                    {deptComparison.map((dept: any, idx: number) => {
                      const startX = 50 + (idx * 150);
                      const hT = (dept.avgTeaching / 60) * 120;
                      const hR = (dept.avgResearch / 30) * 120;
                      const hS = (dept.avgService / 30) * 120;
                      const hB = (dept.avgBonusScore / 25) * 120;

                      return (
                        <g key={dept.code}>
                          <rect x={startX} y={200 - hT} width="22" height={hT} rx="3" fill="#3b82f6" />
                          <text x={startX + 11} y={192 - hT} textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="700">{dept.avgTeaching}</text>

                          <rect x={startX + 26} y={200 - hR} width="22" height={hR} rx="3" fill="#8b5cf6" />
                          <text x={startX + 37} y={192 - hR} textAnchor="middle" fill="#8b5cf6" fontSize="9" fontWeight="700">{dept.avgResearch}</text>

                          <rect x={startX + 52} y={200 - hS} width="22" height={hS} rx="3" fill="#10b981" />
                          <text x={startX + 63} y={192 - hS} textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="700">{dept.avgService}</text>

                          <rect x={startX + 78} y={200 - hB} width="22" height={hB} rx="3" fill="#ec4899" />
                          <text x={startX + 89} y={192 - hB} textAnchor="middle" fill="#ec4899" fontSize="9" fontWeight="700">{dept.avgBonusScore}</text>

                          <text x={startX + 50} y="222" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">{dept.code}</text>
                          <text x={startX + 50} y="238" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="700">Final: {dept.avgFinalScore}</text>
                        </g>
                      );
                    })}
                    <line x1="30" y1="200" x2={Math.max(deptComparison.length * 160, 600)} y2="200" stroke="var(--text-muted)" strokeWidth="2" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* CHART 3: HORIZONTAL STACKED COMPOSITION BAR CHART */}
          {/* ========================================================================= */}
          {activeChartTab === 'stacked' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>🥞 Stacked Cadre Score Composition</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Proportional contribution of Teaching, Research, Service, and Bonus per designation cadre</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {desigComparison.map((d: any) => {
                  const total = d.avgTeaching + d.avgResearch + d.avgService + d.avgBonusScore || 1;
                  const pctT = (d.avgTeaching / total) * 100;
                  const pctR = (d.avgResearch / total) * 100;
                  const pctS = (d.avgService / total) * 100;
                  const pctB = (d.avgBonusScore / total) * 100;

                  return (
                    <div key={d.designation} style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#6366f1' }}>👨‍🏫 {d.designation} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>({d.count} Faculty)</span></span>
                        <span style={{ fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>Avg Final: {d.avgFinalScore} pts</span>
                      </div>

                      {/* Stacked Progress Bar */}
                      <div style={{ display: 'flex', height: '30px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={{ width: `${pctT}%`, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }} title={`Teaching: ${d.avgTeaching} pts`}>
                          {d.avgTeaching > 0 ? `${d.avgTeaching}` : ''}
                        </div>
                        <div style={{ width: `${pctR}%`, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }} title={`Research: ${d.avgResearch} pts`}>
                          {d.avgResearch > 0 ? `${d.avgResearch}` : ''}
                        </div>
                        <div style={{ width: `${pctS}%`, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }} title={`Service: ${d.avgService} pts`}>
                          {d.avgService > 0 ? `${d.avgService}` : ''}
                        </div>
                        <div style={{ width: `${pctB}%`, background: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }} title={`Bonus: ${d.avgBonusScore} pts`}>
                          {d.avgBonusScore > 0 ? `+${d.avgBonusScore}` : ''}
                        </div>
                      </div>

                      {/* Score Breakdown Pills */}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                        <span style={{ color: '#3b82f6' }}>Teaching: {d.avgTeaching}</span>
                        <span style={{ color: '#8b5cf6' }}>Research: {d.avgResearch}</span>
                        <span style={{ color: '#10b981' }}>Service: {d.avgService}</span>
                        <span style={{ color: '#ec4899' }}>* Bonus: {d.avgBonusScore}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CHART 4: SMOOTH CUBIC SPLINE AREA TREND CHART */}
          {/* ========================================================================= */}
          {activeChartTab === 'spline' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>📉 Smooth Spline Area Trend Trajectory</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Multi-year score growth comparison between Total Core Score and Final Score</p>
              </div>

              {yoyTrend.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No historical academic year data available</p>
              ) : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <svg viewBox="0 0 680 230" style={{ width: '100%', height: '230px', background: 'var(--bg-elevated)', borderRadius: '12px', padding: '16px' }}>
                    {[0, 25, 50, 75, 100].map(val => {
                      const y = 180 - (val * 1.5);
                      return (
                        <g key={val}>
                          <line x1="40" y1={y} x2="660" y2={y} stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
                          <text x="15" y={y + 4} fill="var(--text-muted)" fontSize="9" fontWeight="600">{val}</text>
                        </g>
                      );
                    })}

                    {yoyTrend.map((yItem: any, idx: number) => {
                      const x = 90 + (idx * 160);
                      const yTotal = 180 - (yItem.avgTotal * 1.5);
                      const yFinal = 180 - (yItem.avgFinal * 1.5);
                      const nextItem = yoyTrend[idx + 1];

                      return (
                        <g key={yItem.year}>
                          {nextItem && (
                            <>
                              <line x1={x} y1={yTotal} x2={90 + ((idx + 1) * 160)} y2={180 - (nextItem.avgTotal * 1.5)} stroke="#f59e0b" strokeWidth="3" />
                              <line x1={x} y1={yFinal} x2={90 + ((idx + 1) * 160)} y2={180 - (nextItem.avgFinal * 1.5)} stroke="#10b981" strokeWidth="3" />
                            </>
                          )}

                          <circle cx={x} cy={yTotal} r="6" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                          <text x={x} y={yTotal - 10} textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="700">{yItem.avgTotal}</text>

                          <circle cx={x} cy={yFinal} r="6" fill="#10b981" stroke="#fff" strokeWidth="2" />
                          <text x={x} y={yFinal - 10} textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="700">{yItem.avgFinal}</text>

                          <text x={x} y="202" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">📅 {yItem.year}</text>
                        </g>
                      );
                    })}
                    <line x1="40" y1="180" x2="660" y2="180" stroke="var(--text-muted)" strokeWidth="2" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* CHART 5: TARGET COMPLIANCE SECTION GAUGES */}
          {/* ========================================================================= */}
          {activeChartTab === 'gauge' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>🎯 Category Section Attainment Gauges</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Institutional average attainment vs legacy category cap ceilings</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                <GaugeCard title="Teaching Attainment" value={summary.avgTeaching || 0} max={60} color="#3b82f6" sub="Max 60 pts (Assistant Prof)" />
                <GaugeCard title="Research Attainment" value={summary.avgResearch || 0} max={30} color="#8b5cf6" sub="Max 30 pts (Professor Cap)" />
                <GaugeCard title="Service Attainment" value={summary.avgService || 0} max={30} color="#10b981" sub="Max 30 pts (Institutional Cap)" />
                <GaugeCard title="* Bonus Utilization" value={summary.avgBonusScore || 0} max={25} color="#ec4899" sub="Overflow Research Bonus" />
              </div>
            </div>
          )}

          {/* Top Performers Leaderboard Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>🏆 Top Performing Faculty Leaderboard</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Highest overall scoring faculty members based on active search filters</p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px 14px' }}>Rank</th>
                    <th style={{ padding: '12px 14px' }}>Faculty Name</th>
                    <th style={{ padding: '12px 14px' }}>Department</th>
                    <th style={{ padding: '12px 14px' }}>Designation</th>
                    <th style={{ padding: '12px 14px' }}>Year</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Score</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>* Bonus</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Final Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topPerformers.map((fp: any, idx: number) => (
                    <tr key={fp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>{fp.facultyName}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{fp.department}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{fp.designation}</td>
                      <td style={{ padding: '12px 14px' }}>{fp.academicYear}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fp.totalScore.toFixed(1)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#ec4899' }}>{fp.bonusScore.toFixed(1)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{fp.finalScore.toFixed(1)}</td>
                    </tr>
                  ))}
                  {topPerformers.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No top performers data available for the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GaugeCard({ title, value, max, color, sub }: { title: string; value: number; max: number; color: string; sub: string }) {
  const pct = Math.min(Math.round((value / max) * 100), 100);
  const strokeDasharray = `${(pct / 100) * 251.2} 251.2`;

  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '10px' }}>
        <svg width="120" height="120" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-card)" strokeWidth="12" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'all 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
          {pct}%
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontWeight: 800, fontSize: '1.1rem', color, marginTop: '2px' }}>{value} / {max} pts</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>
    </div>
  );
}
