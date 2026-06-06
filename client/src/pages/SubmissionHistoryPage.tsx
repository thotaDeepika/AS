import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { applicationsApi } from '../lib/api';
import StatusBadge from '../components/StatusBadge';

export default function SubmissionHistoryPage() {
  const navigate = useNavigate();
  const [historyApps, setHistoryApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const appRes = await applicationsApi.list();
        const apps = appRes.data.data.applications || [];
        setHistoryApps(apps);
      } catch (err) {
        console.error('Failed to load applications:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="page-loader"><div className="loader-spinner" /><p>Loading history...</p></div>;
  }

  return (
    <div className="submission-history-page">
      <div className="page-title">
        <h2>📜 Submission History</h2>
        <p>View your past appraisal submissions and their final scores.</p>
      </div>

      {historyApps.length === 0 ? (
        <div className="app-empty-state">
          <div className="empty-icon">📭</div>
          <h2>No History Found</h2>
          <p>You haven't submitted any appraisal applications yet.</p>
        </div>
      ) : (
        <div className="reports-table-wrapper" style={{ marginTop: '2rem' }}>
          <table className="reports-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Academic Year</th>
                <th>Status</th>
                <th>Score</th>
                <th>Submitted Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {historyApps.map(app => (
                <tr key={app.id}>
                  <td>{app.academic_year}</td>
                  <td><StatusBadge status={app.status} size="sm" /></td>
                  <td>{app.total_score != null ? Number(app.total_score).toFixed(1) : '—'}</td>
                  <td>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <button 
                      className="btn-small" 
                      onClick={() => navigate(`/applications?id=${app.id}`)}
                    >
                      View Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
