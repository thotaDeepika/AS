import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      api.get('/admin/stats').then(r => setStats(r.data.data.stats)).catch(() => {});
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="dashboard-content">
      <div className="dashboard-welcome-card">
        <div className="welcome-text">
          <h1>Welcome back, {['PRINCIPAL', 'ADMIN', 'REVIEWER', 'ACCOUNTS'].includes(user.role) ? user.name : user.name.split(' ')[0]}! 👋</h1>
          <p>Here's what's happening with your appraisal system today.</p>
        </div>
      </div>

      {/* Admin Stats Overview */}
      {user.role === 'ADMIN' && stats && (
        <div className="stats-grid">
          <StatCard label="Total Users" value={stats.total_users} icon="👥" color="#6366f1" />
          <StatCard label="Departments" value={stats.total_departments} icon="🏛️" color="#8b5cf6" />
          <StatCard label="Applications" value={stats.total_applications} icon="📝" color="#3b82f6" />
          <StatCard
            label="Pending Review"
            value={(stats.applications?.SUBMITTED || 0) + (stats.applications?.HOD_REVIEWED || 0)}
            icon="⏳"
            color="#f59e0b"
          />
        </div>
      )}

      {/* Quick Action Cards */}
      <h2 className="section-title">Quick Actions</h2>
      <div className="dashboard-cards">
        {user.role === 'ADMIN' && (
          <>
            <DashCard title="User Management" desc="Add, edit, and manage faculty accounts" icon="👥" color="#6366f1" onClick={() => navigate('/users')} />
            <DashCard title="Scoring Config" desc="Configure appraisal categories & rules" icon="⚙️" color="#8b5cf6" onClick={() => navigate('/scoring')} />
            <DashCard title="Assign Reviewers" desc="Assign reviewers to applications" icon="🔀" color="#3b82f6" onClick={() => navigate('/assign-reviewers')} />
            <DashCard title="Audit Logs" desc="View system activity and logs" icon="🔍" color="#ef4444" onClick={() => navigate('/audit-logs')} />
          </>
        )}
        {user.role === 'FACULTY' && (
          <>
            <DashCard title="My Application" desc="Create or continue your appraisal" icon="📝" color="#10b981" onClick={() => navigate('/applications')} />
            <DashCard title="Submission History" desc="View your past applications" icon="📜" color="#3b82f6" onClick={() => navigate('/history')} />
          </>
        )}
        {user.role === 'HOD' && (
          <>
            <DashCard title="Pending Reviews" desc="Review department applications" icon="📋" color="#3b82f6" onClick={() => navigate('/reviews')} />
            <DashCard title="All Applications" desc="View department faculty submissions" icon="📝" color="#10b981" onClick={() => navigate('/applications')} />
          </>
        )}
        {user.role === 'PRINCIPAL' && (
          <>
            <DashCard title="All Applications" desc="Review and approve applications" icon="📋" color="#8b5cf6" onClick={() => navigate('/applications')} />
            <DashCard title="Reports" desc="Generate institutional reports" icon="📈" color="#3b82f6" onClick={() => navigate('/reports')} />
          </>
        )}
        {user.role === 'REVIEWER' && (
          <DashCard title="Assigned Reviews" desc="Review assigned applications" icon="📋" color="#f59e0b" onClick={() => navigate('/reviews')} />
        )}
        {user.role === 'ACCOUNTS' && (
          <DashCard title="Approved Applications" desc="Process approved increments" icon="💰" color="#6366f1" onClick={() => navigate('/accounts')} />
        )}
      </div>

      {/* Session Info */}
      <div className="session-info-card">
        <h3>Session Information</h3>
        <div className="info-grid">
          <div><span className="info-label">Email</span><span className="info-value">{user.email}</span></div>
          <div><span className="info-label">Role</span><span className="info-value">{user.role.replace(/_/g, ' ')}</span></div>
          {user.designation && <div><span className="info-label">Designation</span><span className="info-value">{user.designation.replace(/_/g, ' ')}</span></div>}
          {!['PRINCIPAL', 'ADMIN', 'REVIEWER', 'ACCOUNTS'].includes(user.role) && <div><span className="info-label">Department</span><span className="info-value">{user.department?.name}</span></div>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="stat-card" style={{ '--stat-color': color } as React.CSSProperties}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
      </div>
    </div>
  );
}

function DashCard({ title, desc, icon, color, onClick }: { title: string; desc: string; icon: string; color: string; onClick?: () => void }) {
  return (
    <div className="dash-card" style={{ '--card-accent': color } as React.CSSProperties} onClick={onClick}>
      <div className="dash-card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <span className="dash-card-arrow">→</span>
    </div>
  );
}
