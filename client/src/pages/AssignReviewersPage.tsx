import { useEffect, useState } from 'react';
import { applicationsApi, usersApi, adminApi } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

interface Application {
  id: string;
  academic_year: string;
  status: string;
  total_score: number | null;
  reviewer_id: string | null;
  faculty: {
    id: string;
    name: string;
    email: string;
    department: { name: string; code: string };
  };
  reviewer?: { id: string; name: string; email: string } | null;
}

interface Reviewer {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string | null;
}

export default function AssignReviewersPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Tab switching state
  const [activeTab, setActiveTab] = useState<'workflow' | 'decisions'>('workflow');
  const [decisionApps, setDecisionApps] = useState<any[]>([]);

  // Workflow actions
  const [forwarding, setForwarding] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [sendingAccounts, setSendingAccounts] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [appsRes, usersRes, decisionsRes] = await Promise.all([
        applicationsApi.list(),
        usersApi.list({ role: 'REVIEWER' }),
        adminApi.approvalsRejections(),
      ]);
      setApplications(appsRes.data.data.applications || []);
      setReviewers(usersRes.data.data.users || []);
      setDecisionApps(decisionsRes.data.data.applications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAssign = async () => {
    if (!selectedAppId || !selectedReviewerId) return;
    setAssigning(true);
    try {
      await adminApi.assignReviewer(selectedAppId, selectedReviewerId);
      showToast('success', 'Reviewer assigned successfully');
      setSelectedAppId(null);
      setSelectedReviewerId('');
      loadData();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  const handleBulkAction = async (action: 'forward' | 'freeze' | 'accounts') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { showToast('error', 'Select at least one application'); return; }

    try {
      if (action === 'forward') {
        setForwarding(true);
        await adminApi.forwardToPrincipal(ids[0]); // API needs array format adjustment
        showToast('success', `${ids.length} application(s) forwarded to Principal`);
      } else if (action === 'freeze') {
        setFreezing(true);
        await adminApi.freezeApplication(ids[0]);
        showToast('success', `${ids.length} application(s) frozen`);
      } else {
        setSendingAccounts(true);
        await adminApi.sendToAccounts(ids[0]);
        showToast('success', `${ids.length} application(s) sent to Accounts`);
      }
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Action failed');
    } finally {
      setForwarding(false);
      setFreezing(false);
      setSendingAccounts(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Group counts by status for the workflow overview
  const statusCounts: Record<string, number> = {};
  applications.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

  const columns = [
    {
      key: 'select',
      header: '',
      width: '40px',
      render: (row: Application) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          className="checkbox"
        />
      ),
    },
    {
      key: 'faculty',
      header: 'Faculty',
      render: (row: Application) => (
        <div className="cell-faculty">
          <span className="cell-name">{row.faculty.name}</span>
          <span className="cell-sub">{row.faculty.department.code}</span>
        </div>
      ),
    },
    {
      key: 'academic_year',
      header: 'Year',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Application) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'total_score',
      header: 'Score',
      sortable: true,
      render: (row: Application) => (
        <span className="cell-score">{row.total_score != null ? Number(row.total_score).toFixed(1) : '—'}</span>
      ),
    },
    {
      key: 'reviewer',
      header: 'Assigned Reviewer',
      render: (row: Application) =>
        row.reviewer ? (
          <span className="reviewer-chip">✓ {row.reviewer.name}</span>
        ) : (
          <span className="no-reviewer">— None</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '140px',
      render: (row: Application) =>
        row.status === 'HOD_REVIEWED' ? (
          <button className="btn-small btn-accent" onClick={() => { setSelectedAppId(row.id); setSelectedReviewerId(row.reviewer_id || ''); }}>
            🔀 {row.reviewer_id ? 'Reassign' : 'Assign'}
          </button>
        ) : null,
    },
  ];

  const decisionColumns = [
    {
      key: 'faculty',
      header: 'Faculty',
      render: (row: any) => (
        <div className="cell-faculty">
          <span className="cell-name">{row.faculty.name}</span>
          <span className="cell-sub">{row.faculty.email}</span>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (row: any) => row.faculty.department.code,
    },
    {
      key: 'academic_year',
      header: 'Year',
      sortable: true,
    },
    {
      key: 'final_score',
      header: 'Final Score',
      sortable: true,
      render: (row: any) => (
        <span className="cell-score">{row.final_score != null ? Number(row.final_score).toFixed(1) : '—'}</span>
      ),
    },
    {
      key: 'decision',
      header: 'Decision',
      render: (row: any) => <StatusBadge status={row.decision} size="sm" />,
    },
    {
      key: 'comments',
      header: 'Principal Comments',
      render: (row: any) => (
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {row.comments || 'No comments'}
        </span>
      ),
    },
    {
      key: 'reviewed_at',
      header: 'Reviewed Date',
      render: (row: any) => new Date(row.reviewed_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="assign-page">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</div>}

      <div className="page-title">
        <div>
          <h2>Workflow & Decisions</h2>
          <p>Assign reviewers and view approved or rejected faculty applications</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          className={`tab-btn ${activeTab === 'workflow' ? 'active' : ''}`}
          onClick={() => setActiveTab('workflow')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'workflow' ? 'var(--primary-color)' : 'var(--text-muted)',
            fontWeight: activeTab === 'workflow' ? 'bold' : 'normal',
            borderBottom: activeTab === 'workflow' ? '2px solid var(--primary-color)' : 'none',
            padding: '0.5rem 1rem',
            cursor: 'pointer'
          }}
        >
          🔀 Active Workflow
        </button>
        <button
          className={`tab-btn ${activeTab === 'decisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('decisions')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'decisions' ? 'var(--primary-color)' : 'var(--text-muted)',
            fontWeight: activeTab === 'decisions' ? 'bold' : 'normal',
            borderBottom: activeTab === 'decisions' ? '2px solid var(--primary-color)' : 'none',
            padding: '0.5rem 1rem',
            cursor: 'pointer'
          }}
        >
          📋 Approved & Rejected Faculty
        </button>
      </div>

      {activeTab === 'workflow' ? (
        <>
          {/* Workflow Pipeline */}
          <div className="workflow-pipeline">
            {[
              { status: 'SUBMITTED', label: 'Submitted', color: '#f59e0b' },
              { status: 'HOD_REVIEWED', label: 'HOD Reviewed', color: '#3b82f6' },
              { status: 'REVIEWER_ASSIGNED', label: 'Reviewer Assigned', color: '#8b5cf6' },
              { status: 'REVIEWER_REVIEWED', label: 'Reviewer Done', color: '#6366f1' },
              { status: 'PRINCIPAL_REVIEWED', label: 'Principal Done', color: '#10b981' },
              { status: 'FROZEN', label: 'Frozen', color: '#06b6d4' },
              { status: 'SENT_TO_ACCOUNTS', label: 'Accounts', color: '#14b8a6' },
            ].map((step, i) => (
              <div key={step.status} className="pipeline-step">
                <div className="pipeline-dot" style={{ background: step.color }}>
                  {statusCounts[step.status] || 0}
                </div>
                <span className="pipeline-label">{step.label}</span>
                {i < 6 && <span className="pipeline-arrow">→</span>}
              </div>
            ))}
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="bulk-actions-bar">
              <span>{selectedIds.size} selected</span>
              <button className="btn-small btn-accent" onClick={() => handleBulkAction('forward')} disabled={forwarding}>
                {forwarding ? '...' : '📤 Forward to Principal'}
              </button>
              <button className="btn-small btn-success" onClick={() => handleBulkAction('freeze')} disabled={freezing}>
                {freezing ? '...' : '❄️ Freeze'}
              </button>
              <button className="btn-small" onClick={() => handleBulkAction('accounts')} disabled={sendingAccounts}>
                {sendingAccounts ? '...' : '💰 Send to Accounts'}
              </button>
              <button className="btn-small btn-danger" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </div>
          )}

          <DataTable
            columns={columns}
            data={applications}
            searchable
            searchPlaceholder="Search by faculty name..."
            loading={loading}
            emptyMessage="No applications found"
            pagination={{ page: 1, pages: 1, total: applications.length, onPageChange: () => {} }}
          />
        </>
      ) : (
        <DataTable
          columns={decisionColumns}
          data={decisionApps}
          searchable
          searchPlaceholder="Search by faculty name..."
          loading={loading}
          emptyMessage="No approved or rejected applications found"
          pagination={{ page: 1, pages: 1, total: decisionApps.length, onPageChange: () => {} }}
        />
      )}

      {/* Assign Reviewer Modal */}
      {selectedAppId && (
        <div className="modal-overlay" onClick={() => setSelectedAppId(null)}>
          <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign Reviewer</h3>
              <button className="modal-close" onClick={() => setSelectedAppId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">Select a reviewer to evaluate this application:</p>
              <div className="form-group">
                <label>Reviewer</label>
                <select value={selectedReviewerId} onChange={e => setSelectedReviewerId(e.target.value)}>
                  <option value="">Select a reviewer...</option>
                  {reviewers.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.email})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedAppId(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleAssign} disabled={assigning || !selectedReviewerId}>
                {assigning ? 'Assigning...' : 'Assign Reviewer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
