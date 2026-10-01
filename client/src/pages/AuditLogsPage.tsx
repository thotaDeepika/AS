import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
  user: { id: string; name: string; email: string; role: string };
}

const ACTION_METADATA: Record<string, { icon: string; color: string; label: string }> = {
  LOGIN: { icon: '🔑', color: '#10b981', label: 'User Login' },
  LOGOUT: { icon: '🚪', color: '#64748b', label: 'User Logout' },
  APPLICATION_CREATED: { icon: '📝', color: '#3b82f6', label: 'Application Created' },
  APPLICATION_SUBMITTED: { icon: '📤', color: '#8b5cf6', label: 'Application Submitted' },
  APPLICATION_REVIEWED: { icon: '✅', color: '#10b981', label: 'Application Reviewed' },
  APPLICATION_HOD_REVIEWED: { icon: '🏛️', color: '#3b82f6', label: 'HOD Reviewed' },
  APPLICATION_REVIEWER_REVIEWED: { icon: '🔍', color: '#8b5cf6', label: 'Peer Reviewer Reviewed' },
  APPLICATION_PRINCIPAL_REVIEWED: { icon: '👔', color: '#6366f1', label: 'Principal Reviewed' },
  REVIEWER_ASSIGNED: { icon: '🔀', color: '#f59e0b', label: 'Reviewer Assigned' },
  APPLICATION_FROZEN: { icon: '❄️', color: '#06b6d4', label: 'Application Frozen' },
  SENT_TO_ACCOUNTS: { icon: '💰', color: '#14b8a6', label: 'Sent to Accounts' },
  STATUS_CHANGED: { icon: '🔄', color: '#ec4899', label: 'Status Changed' },
  FILE_UPLOADED: { icon: '📎', color: '#3b82f6', label: 'File Uploaded' },
  COMMENT_ADDED: { icon: '💬', color: '#8b5cf6', label: 'Comment Added' },
  USER_CREATED: { icon: '👤', color: '#10b981', label: 'User Created' },
  USER_UPDATED: { icon: '✏️', color: '#f59e0b', label: 'User Updated' },
  SCORING_CONFIG_UPDATED: { icon: '⚙️', color: '#ef4444', label: 'Scoring Rules Modified' },
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [filterAction, setFilterAction] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: '20' };
      if (filterAction) params.action = filterAction;
      const res = await adminApi.auditLogs(params);
      setLogs(res.data.data.logs || []);
      setTotalPages(res.data.data.pagination?.pages || 1);
      setTotalLogs(res.data.data.pagination?.total || 0);
      setPage(p);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1);
  }, [filterAction]);

  const ACTIONS = Object.keys(ACTION_METADATA);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return { date, time };
  };

  // Client-side search filter by user name or email or entity ID
  const filteredLogs = logs.filter(log => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.user.name.toLowerCase().includes(term) ||
      log.user.email.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="audit-page" style={{ padding: '1.5rem', animation: 'fadeUp 0.4s ease' }}>
      {/* Header */}
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔍</span> System Audit & Activity Logs
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Security compliance timeline and system action records
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: '20px' }}>
            {totalLogs} Total Logged Events
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => loadLogs(page)}
            disabled={loading}
            style={{ fontSize: '0.85rem' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search input */}
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Search by user name, email, or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          />
        </div>

        {/* Action Type Dropdown */}
        <div style={{ minWidth: '200px' }}>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            <option value="">All Event Types</option>
            {ACTIONS.map(a => {
              const meta = ACTION_METADATA[a];
              return (
                <option key={a} value={a}>
                  {meta.icon} {meta.label}
                </option>
              );
            })}
          </select>
        </div>

        {filterAction || searchTerm ? (
          <button
            type="button"
            onClick={() => { setFilterAction(''); setSearchTerm(''); }}
            style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}
          >
            Clear Search
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="page-loader-inline" style={{ padding: '40px', textAlign: 'center' }}><div className="loader-spinner" /><p>Fetching audit trail events...</p></div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '10px' }}>📋</span>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>No matching audit logs found</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Try adjusting your search criteria or event type filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {filteredLogs.map(log => {
            const { date, time } = formatTimestamp(log.created_at);
            const meta = ACTION_METADATA[log.action] || { icon: '📌', color: '#64748b', label: log.action.replace(/_/g, ' ') };
            const isExpanded = expandedId === log.id;

            return (
              <div
                key={log.id}
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${isExpanded ? meta.color : 'var(--border)'}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  boxShadow: isExpanded ? '0 4px 16px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                {/* Summary Row - Shows ONLY necessary details */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}
                >
                  {/* Action Icon & Label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: `${meta.color}15`,
                        border: `1px solid ${meta.color}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem'
                      }}
                    >
                      {meta.icon}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                        {meta.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Target: {log.entity_type} {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Performed By User */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                        {log.user.name}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {log.user.email}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: meta.color }}>
                      {log.user.role}
                    </span>
                  </div>

                  {/* Date, Time & Expand Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                        {date}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {time}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.85rem', color: meta.color, fontWeight: 700 }}>
                      {isExpanded ? '▲ Hide' : '▼ Details'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
                    <h5 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', margin: '0 0 10px 0', fontWeight: 700 }}>
                      📋 Event Payload & Context Details
                    </h5>

                    {/* Formatted Key-Value Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                      <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Event ID</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{log.id}</span>
                      </div>

                      <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>IP Address</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: log.ip_address ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {log.ip_address || '127.0.0.1 (Local)'}
                        </span>
                      </div>

                      <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Entity Reference</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {log.entity_type} {log.entity_id || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Details Object View */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Action Metadata:</span>
                        <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Page {page} of {totalPages} ({totalLogs} events)
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => loadLogs(page - 1)}
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => loadLogs(page + 1)}
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
