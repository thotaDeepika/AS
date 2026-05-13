import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { applicationsApi, departmentsApi, reportsApi } from '../lib/api';

interface Application {
  id: string;
  academic_year: string;
  status: string;
  total_score: number;
  faculty: {
    name: string;
    department: { name: string; code: string };
  };
}

interface Department {
  id: string;
  name: string;
  code: string;
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  HOD_REVIEWED: 'HOD Reviewed',
  REVIEWER_ASSIGNED: 'Reviewer Assigned',
  REVIEWER_REVIEWED: 'Reviewer Reviewed',
  PRINCIPAL_REVIEWED: 'Principal Reviewed',
  FROZEN: 'Frozen',
  SENT_TO_ACCOUNTS: 'Sent to Accounts',
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Filters
  const [yearFilter, setYearFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const isFaculty = user?.role === 'FACULTY';
  const canConsolidate = ['ADMIN', 'PRINCIPAL', 'ACCOUNTS'].includes(user?.role || '');

  useEffect(() => {
    const load = async () => {
      try {
        const [appRes, deptRes] = await Promise.all([
          applicationsApi.list(),
          departmentsApi.list(),
        ]);
        setApplications(appRes.data.data?.applications || []);
        setDepartments(deptRes.data.data?.departments || deptRes.data.data || []);
      } catch (e) {
        console.error('Failed to load data', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDownloadPDF = async (appId: string, year: string) => {
    setDownloading(appId);
    try {
      const res = await reportsApi.downloadAppraisalPDF(appId);
      triggerDownload(res.data, `appraisal_${year}.pdf`);
    } catch (e) {
      console.error('PDF download failed', e);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleConsolidatedPDF = async () => {
    setDownloading('consolidated-pdf');
    try {
      const params: Record<string, string> = {};
      if (yearFilter) params.academic_year = yearFilter;
      if (deptFilter) params.department_id = deptFilter;
      const res = await reportsApi.downloadConsolidatedPDF(params);
      triggerDownload(res.data, `consolidated_report${yearFilter ? `_${yearFilter}` : ''}.pdf`);
    } catch (e) {
      console.error('Consolidated PDF failed', e);
      alert('Failed to download report.');
    } finally {
      setDownloading(null);
    }
  };

  const handleExcelDownload = async () => {
    setDownloading('excel');
    try {
      const params: Record<string, string> = {};
      if (yearFilter) params.academic_year = yearFilter;
      if (deptFilter) params.department_id = deptFilter;
      const res = await reportsApi.downloadExcel(params);
      triggerDownload(res.data, `appraisal_report${yearFilter ? `_${yearFilter}` : ''}.xlsx`);
    } catch (e) {
      console.error('Excel download failed', e);
      alert('Failed to download Excel report.');
    } finally {
      setDownloading(null);
    }
  };

  // Filter applications
  const filteredApps = applications.filter(app => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!app.faculty.name.toLowerCase().includes(q) && !app.faculty.department.name.toLowerCase().includes(q)) return false;
    }
    if (yearFilter && app.academic_year !== yearFilter) return false;
    return true;
  });

  const years = [...new Set(applications.map(a => a.academic_year))].sort().reverse();

  if (loading) {
    return (
      <div className="reports-page">
        <div className="page-header">
          <h1>📈 Reports</h1>
        </div>
        <div className="reports-loading">
          <div className="skeleton-block" style={{ height: 200 }} />
          <div className="skeleton-block" style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page animate-fadeIn">
      <div className="page-header">
        <h1>📈 Reports & Exports</h1>
        <p className="page-subtitle">Generate PDF reports and Excel exports for appraisal data</p>
      </div>

      {/* ── Consolidated Reports (Admin/Principal/Accounts) ── */}
      {canConsolidate && (
        <section className="reports-section animate-slideUp">
          <div className="reports-section-header">
            <div>
              <h2>📊 Consolidated Reports</h2>
              <p className="text-muted">Generate department-wise or institution-wide reports</p>
            </div>
          </div>

          <div className="reports-filters">
            <div className="filter-group">
              <label>Academic Year</label>
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                <option value="">All Years</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Department</label>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="reports-download-grid">
            <button
              className="report-download-card"
              onClick={handleConsolidatedPDF}
              disabled={downloading === 'consolidated-pdf'}
            >
              <div className="download-icon pdf-icon">📄</div>
              <div className="download-info">
                <h3>Consolidated PDF</h3>
                <p>Full report with faculty scores, department summary, and rankings</p>
              </div>
              <span className="download-badge">
                {downloading === 'consolidated-pdf' ? '⏳ Generating...' : 'Download PDF'}
              </span>
            </button>

            <button
              className="report-download-card"
              onClick={handleExcelDownload}
              disabled={downloading === 'excel'}
            >
              <div className="download-icon excel-icon">📊</div>
              <div className="download-info">
                <h3>Excel Workbook</h3>
                <p>3-sheet workbook: Summary, Faculty Details, Category Breakdown</p>
              </div>
              <span className="download-badge excel">
                {downloading === 'excel' ? '⏳ Generating...' : 'Download Excel'}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ── Individual Appraisal Reports ── */}
      <section className="reports-section animate-slideUp" style={{ animationDelay: '0.1s' }}>
        <div className="reports-section-header">
          <div>
            <h2>{isFaculty ? '📝 My Appraisal Reports' : '📋 Individual Appraisal Reports'}</h2>
            <p className="text-muted">
              {isFaculty ? 'Download your appraisal forms as PDF' : 'Download individual faculty appraisal PDFs'}
            </p>
          </div>
          {!isFaculty && (
            <div className="search-box">
              <input
                type="text"
                placeholder="Search faculty or department..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {filteredApps.length === 0 ? (
          <div className="reports-empty">
            <span className="empty-icon">📭</span>
            <p>No applications found{searchQuery ? ' matching your search' : ''}</p>
          </div>
        ) : (
          <div className="reports-table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>#</th>
                  {!isFaculty && <th>Faculty</th>}
                  {!isFaculty && <th>Department</th>}
                  <th>Academic Year</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((app, i) => (
                  <tr key={app.id}>
                    <td>{i + 1}</td>
                    {!isFaculty && <td className="faculty-name">{app.faculty.name}</td>}
                    {!isFaculty && <td><span className="dept-badge">{app.faculty.department.code}</span></td>}
                    <td className="year-cell">{app.academic_year}</td>
                    <td>
                      <span className={`status-pill status-${app.status.toLowerCase().replace(/_/g, '-')}`}>
                        {statusLabels[app.status] || app.status}
                      </span>
                    </td>
                    <td className="score-cell">{Number(app.total_score).toFixed(1)}</td>
                    <td>
                      <button
                        className="btn-download-pdf"
                        onClick={() => handleDownloadPDF(app.id, app.academic_year)}
                        disabled={downloading === app.id || app.status === 'DRAFT'}
                        title={app.status === 'DRAFT' ? 'Submit application first' : 'Download PDF'}
                      >
                        {downloading === app.id ? '⏳' : '📥'} PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Quick Stats ── */}
      <section className="reports-stats animate-slideUp" style={{ animationDelay: '0.2s' }}>
        <div className="stat-card">
          <span className="stat-value">{applications.length}</span>
          <span className="stat-label">Total Applications</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{applications.filter(a => a.status !== 'DRAFT').length}</span>
          <span className="stat-label">Submitted</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {applications.length > 0
              ? (applications.reduce((s, a) => s + Number(a.total_score), 0) / applications.length).toFixed(1)
              : '0'}
          </span>
          <span className="stat-label">Avg Score</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{years.length}</span>
          <span className="stat-label">Academic Years</span>
        </div>
      </section>
    </div>
  );
}
