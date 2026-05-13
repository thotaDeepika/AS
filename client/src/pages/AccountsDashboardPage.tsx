import { useEffect, useState } from 'react';
import { applicationsApi } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

interface Application {
  id: string;
  academic_year: string;
  status: string;
  total_score: number | null;
  frozen_at: string | null;
  sent_to_accounts_at: string | null;
  faculty: {
    id: string;
    name: string;
    email: string;
    department: { name: string; code: string };
    designation: string | null;
  };
}

export default function AccountsDashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');

  useEffect(() => { loadApplications(); }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await applicationsApi.list();
      // Accounts sees frozen and sent-to-accounts applications
      const apps = (res.data.data.applications || []).filter((a: Application) =>
        ['FROZEN', 'SENT_TO_ACCOUNTS'].includes(a.status)
      );
      setApplications(apps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Unique departments and years for filters
  const departments = [...new Set(applications.map(a => a.faculty.department.code))].sort();
  const years = [...new Set(applications.map(a => a.academic_year))].sort().reverse();

  const filtered = applications.filter(a => {
    if (filterDept !== 'ALL' && a.faculty.department.code !== filterDept) return false;
    if (filterYear !== 'ALL' && a.academic_year !== filterYear) return false;
    return true;
  });

  // Summary stats
  const totalScore = filtered.reduce((sum, a) => sum + (a.total_score ? Number(a.total_score) : 0), 0);
  const avgScore = filtered.length > 0 ? (totalScore / filtered.length).toFixed(1) : '0.0';
  const frozenCount = filtered.filter(a => a.status === 'FROZEN').length;
  const sentCount = filtered.filter(a => a.status === 'SENT_TO_ACCOUNTS').length;

  // Department-wise breakdown
  const deptBreakdown = departments.map(dept => {
    const deptApps = filtered.filter(a => a.faculty.department.code === dept);
    return {
      dept,
      count: deptApps.length,
      avgScore: deptApps.length > 0
        ? (deptApps.reduce((s, a) => s + (a.total_score ? Number(a.total_score) : 0), 0) / deptApps.length).toFixed(1)
        : '0.0',
    };
  });

  const columns = [
    {
      key: 'faculty',
      header: 'Faculty',
      render: (row: Application) => (
        <div className="cell-faculty">
          <span className="cell-name">{row.faculty.name}</span>
          <span className="cell-sub">{row.faculty.department.code} • {(row.faculty.designation || 'N/A').replace(/_/g, ' ')}</span>
        </div>
      ),
    },
    { key: 'academic_year', header: 'Year', sortable: true },
    {
      key: 'status',
      header: 'Status',
      render: (row: Application) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'total_score',
      header: 'Final Score',
      sortable: true,
      render: (row: Application) => (
        <span className="cell-score">{row.total_score != null ? Number(row.total_score).toFixed(1) : '—'}</span>
      ),
    },
    {
      key: 'frozen_at',
      header: 'Frozen Date',
      render: (row: Application) =>
        row.frozen_at ? new Date(row.frozen_at).toLocaleDateString('en-IN') : '—',
    },
    {
      key: 'sent_to_accounts_at',
      header: 'Sent Date',
      render: (row: Application) =>
        row.sent_to_accounts_at ? new Date(row.sent_to_accounts_at).toLocaleDateString('en-IN') : '—',
    },
  ];

  return (
    <div className="accounts-page">
      <div className="page-title">
        <div>
          <h2>Accounts Dashboard</h2>
          <p>Consolidated view of finalized appraisals for increment processing</p>
        </div>
        <div className="config-badge">💰 {filtered.length} Finalized</div>
      </div>

      {/* Summary Stats */}
      <div className="accounts-stats">
        <div className="accounts-stat-card">
          <span className="accounts-stat-icon">❄️</span>
          <span className="accounts-stat-value">{frozenCount}</span>
          <span className="accounts-stat-label">Frozen</span>
        </div>
        <div className="accounts-stat-card">
          <span className="accounts-stat-icon">💰</span>
          <span className="accounts-stat-value">{sentCount}</span>
          <span className="accounts-stat-label">Sent to Accounts</span>
        </div>
        <div className="accounts-stat-card">
          <span className="accounts-stat-icon">📊</span>
          <span className="accounts-stat-value">{avgScore}</span>
          <span className="accounts-stat-label">Avg Score</span>
        </div>
        <div className="accounts-stat-card">
          <span className="accounts-stat-icon">🏛️</span>
          <span className="accounts-stat-value">{departments.length}</span>
          <span className="accounts-stat-label">Departments</span>
        </div>
      </div>

      {/* Department Breakdown */}
      {deptBreakdown.length > 0 && (
        <div className="accounts-dept-breakdown">
          <h4>Department Summary</h4>
          <div className="dept-breakdown-grid">
            {deptBreakdown.map(d => (
              <div key={d.dept} className="dept-breakdown-card" onClick={() => setFilterDept(filterDept === d.dept ? 'ALL' : d.dept)}>
                <span className="dept-breakdown-code">{d.dept}</span>
                <span className="dept-breakdown-count">{d.count} faculty</span>
                <span className="dept-breakdown-score">Avg: {d.avgScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="ALL">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="ALL">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="filter-count">{filtered.length} of {applications.length} applications</span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchable
        searchPlaceholder="Search by faculty name or department..."
        loading={loading}
        emptyMessage="No finalized applications found"
        pagination={{ page: 1, pages: 1, total: filtered.length, onPageChange: () => {} }}
      />
    </div>
  );
}
