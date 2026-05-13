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

const ACTION_ICONS: Record<string, string> = {
  LOGIN: '🔑',
  LOGOUT: '🚪',
  APPLICATION_CREATED: '📝',
  APPLICATION_SUBMITTED: '📤',
  APPLICATION_REVIEWED: '✅',
  APPLICATION_HOD_REVIEWED: '🏛️',
  APPLICATION_REVIEWER_REVIEWED: '🔍',
  APPLICATION_PRINCIPAL_REVIEWED: '👔',
  REVIEWER_ASSIGNED: '🔀',
  APPLICATION_FROZEN: '❄️',
  SENT_TO_ACCOUNTS: '💰',
  STATUS_CHANGED: '🔄',
  FILE_UPLOADED: '📎',
  COMMENT_ADDED: '💬',
  USER_CREATED: '👤',
  USER_UPDATED: '✏️',
  SCORING_CONFIG_UPDATED: '⚙️',
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: '#10b981',
  LOGOUT: '#6b7280',
  APPLICATION_CREATED: '#3b82f6',
  APPLICATION_SUBMITTED: '#8b5cf6',
  REVIEWER_ASSIGNED: '#f59e0b',
  APPLICATION_FROZEN: '#06b6d4',
  SENT_TO_ACCOUNTS: '#14b8a6',
  USER_CREATED: '#6366f1',
  USER_UPDATED: '#6366f1',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: '30' };
      if (filterAction) params.action = filterAction;
      const res = await adminApi.auditLogs(params);
      setLogs(res.data.data.logs || []);
      setTotalPages(res.data.data.pagination?.pages || 1);
      setPage(p);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(1); }, [filterAction]);

  const ACTIONS = Object.keys(ACTION_ICONS);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return { date, time };
  };

  return (
    <div className="audit-page">
      <div className="page-title">
        <div>
          <h2>Audit Logs</h2>
          <p>Track all system actions and user activity</p>
        </div>
        <div className="audit-filter">
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); }}>
            <option value="">All Actions</option>
            {ACTIONS.map(a => (
              <option key={a} value={a}>{ACTION_ICONS[a]} {a.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="page-loader-inline"><div className="loader-spinner" /><p>Loading logs...</p></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <p>No audit logs found</p>
        </div>
      ) : (
        <div className="audit-timeline">
          {logs.map(log => {
            const { date, time } = formatTimestamp(log.created_at);
            const icon = ACTION_ICONS[log.action] || '📌';
            const color = ACTION_COLORS[log.action] || '#6b7280';
            return (
              <div
                key={log.id}
                className={`audit-entry ${expandedId === log.id ? 'expanded' : ''}`}
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="audit-entry-dot" style={{ background: color }}>{icon}</div>
                <div className="audit-entry-content">
                  <div className="audit-entry-header">
                    <div className="audit-entry-main">
                      <span className="audit-action" style={{ color }}>{log.action.replace(/_/g, ' ')}</span>
                      <span className="audit-entity">{log.entity_type} {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ''}</span>
                    </div>
                    <div className="audit-entry-meta">
                      <span className="audit-user">{log.user.name}</span>
                      <span className="audit-role">{log.user.role}</span>
                      <span className="audit-time">{date} {time}</span>
                    </div>
                  </div>

                  {expandedId === log.id && log.details && (
                    <div className="audit-details">
                      <pre>{JSON.stringify(log.details, null, 2)}</pre>
                      {log.ip_address && <span className="audit-ip">IP: {log.ip_address}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="audit-pagination">
          <button className="btn-small" disabled={page <= 1} onClick={() => loadLogs(page - 1)}>← Previous</button>
          <span className="pagination-info">Page {page} of {totalPages}</span>
          <button className="btn-small" disabled={page >= totalPages} onClick={() => loadLogs(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
