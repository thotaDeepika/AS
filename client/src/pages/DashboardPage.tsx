import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { analyticsApi, applicationsApi } from '../lib/api';
import ScoreCard from '../components/ScoreCard';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [recentApps, setRecentApps] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (!user) return;

      // 1. Admin System Stats
      if (user.role === 'ADMIN') {
        try {
          const res = await api.get('/admin/stats');
          setAdminStats(res.data.data.stats);
        } catch (e) {
          console.error('Failed to load admin stats:', e);
        }
      }

      // 2. Role Analytics Data for ADMIN, PRINCIPAL, HOD
      if (['ADMIN', 'PRINCIPAL', 'HOD'].includes(user.role)) {
        try {
          const res = await analyticsApi.dashboard({});
          setAnalyticsData(res.data.data);
        } catch (e) {
          console.error('Failed to load analytics data:', e);
        }
      }

      // 3. Applications List (Faculty my app / HOD / Principal reviews)
      try {
        const res = await applicationsApi.list();
        const apps = res.data.data.applications || [];
        setRecentApps(apps.slice(0, 5));
      } catch (e) {
        console.error('Failed to load recent applications:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const summary = analyticsData?.summary || {};
  const isFaculty = user.role === 'FACULTY';
  const isHod = user.role === 'HOD';
  const isPrincipal = user.role === 'PRINCIPAL';
  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="dashboard-page" style={{ padding: '1.5rem', animation: 'fadeUp 0.4s ease' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)',
          borderRadius: '16px',
          padding: '28px 32px',
          color: '#ffffff',
          marginBottom: '1.8rem',
          boxShadow: '0 10px 25px rgba(79, 70, 229, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.2rem'
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '10px' }}>
            <span>⚡ RIT APPRAISAL PORTAL</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            Welcome back, {user.name}! 👋
          </h1>
          <p style={{ margin: '6px 0 0 0', opacity: 0.9, fontSize: '0.95rem', maxWidth: '600px' }}>
            {isFaculty && 'Manage your annual academic performance score, upload proof documents, and track approval status.'}
            {isHod && `Department Head Workspace • Monitor ${user.department?.name || 'Department'} appraisals and review faculty score submissions.`}
            {isPrincipal && 'Executive Principal Dashboard • Review institution performance, approve appraisals, and inspect analytics.'}
            {isAdmin && 'System Administrator Workspace • System configuration, scoring rules, user roles, and audit tracking.'}
            {user.role === 'CHAIRMAN_REVIEWER' && 'Chairman Reviewer Workspace • Conduct apex committee appraisal reviews, evaluate peer reviews, and submit recommendations.'}
            {!isFaculty && !isHod && !isPrincipal && !isAdmin && user.role !== 'CHAIRMAN_REVIEWER' && 'Appraisal management workspace and review workflows.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {['ADMIN', 'PRINCIPAL', 'HOD'].includes(user.role) && (
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              style={{
                background: '#ffffff',
                color: '#4f46e5',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📊 Interactive Analytics & Graphs →
            </button>
          )}

          {(user.role === 'REVIEWER' || user.role === 'CHAIRMAN_REVIEWER') && (
            <button
              type="button"
              onClick={() => navigate('/reviews')}
              style={{
                background: user.role === 'CHAIRMAN_REVIEWER' ? '#ec4899' : '#f59e0b',
                color: '#ffffff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📋 {user.role === 'CHAIRMAN_REVIEWER' ? 'Chairman Reviews' : 'Assigned Reviews'} →
            </button>
          )}

          {isFaculty && (
            <button
              type="button"
              onClick={() => navigate('/applications')}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📝 Open My Application →
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="page-loader-inline" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="loader-spinner" />
          <p>Loading dashboard metrics & workspace statistics...</p>
        </div>
      ) : (
        <>
          {/* 2. Primary KPI Overview Cards (Visible for ALL roles) */}
          <div style={{ marginBottom: '1.8rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
              🎯 Performance & Overview Metrics
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem' }}>
              {/* Admin Specific Stat Cards */}
              {isAdmin && adminStats && (
                <>
                  <StatCard label="Total Registered Users" value={adminStats.total_users || 0} icon="👥" color="#6366f1" sub="Faculty, HODs, Reviewers" />
                  <StatCard label="Academic Departments" value={adminStats.total_departments || 0} icon="🏛️" color="#8b5cf6" sub="Active Faculties" />
                  <StatCard label="Total Applications" value={adminStats.total_applications || 0} icon="📝" color="#3b82f6" sub="All Academic Years" />
                  <StatCard label="Pending Review" value={(adminStats.applications?.SUBMITTED || 0) + (adminStats.applications?.HOD_REVIEWED || 0)} icon="⏳" color="#f59e0b" sub="Awaiting Action" />
                </>
              )}

              {/* Institution Score Overview (Admin, Principal, HOD) */}
              {['ADMIN', 'PRINCIPAL', 'HOD'].includes(user.role) && summary.totalApplications !== undefined && (
                <>
                  <ScoreCard label="Submissions" score={summary.totalApplications || 0} color="#6366f1" size="sm" />
                  <ScoreCard label="Avg Teaching" score={summary.avgTeaching || 0} color="#3b82f6" size="sm" />
                  <ScoreCard label="Avg Research" score={summary.avgResearch || 0} color="#8b5cf6" size="sm" />
                  <ScoreCard label="Avg Service" score={summary.avgService || 0} color="#10b981" size="sm" />
                  <ScoreCard label="Avg Total Score" score={summary.avgTotalScore || 0} color="#f59e0b" />
                  <ScoreCard label="* Avg Bonus" score={summary.avgBonusScore || 0} color="#ec4899" />
                  <ScoreCard label="Avg Final Score" score={summary.avgFinalScore || 0} color="#10b981" />
                </>
              )}

              {/* Faculty Specific Overview Card */}
              {isFaculty && (
                <>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Submissions</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#3b82f6' }}>{recentApps.length}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Appraisal applications on record</span>
                  </div>

                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Department</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#8b5cf6' }}>{user.department?.name || 'Assigned Dept'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.designation?.replace(/_/g, ' ') || 'Faculty'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 3. Quick Action Grid */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
              ⚡ Quick Actions & Workflows
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
              {isAdmin && (
                <>
                  <ActionCard title="User Management" desc="Manage faculty accounts, assign roles, & reset credentials" icon="👥" color="#6366f1" onClick={() => navigate('/users')} />
                  <ActionCard title="Scoring Configuration" desc="Configure category caps, dynamic columns, & scoring keys" icon="⚙️" color="#8b5cf6" onClick={() => navigate('/scoring')} />
                  <ActionCard title="Assign Reviewers" desc="Map faculty applications to peer reviewers & HODs" icon="🔀" color="#3b82f6" onClick={() => navigate('/assign-reviewers')} />
                  <ActionCard title="Audit Logs" desc="Track security events, data edits, & system activity" icon="🔍" color="#ef4444" onClick={() => navigate('/audit-logs')} />
                </>
              )}

              {isFaculty && (
                <>
                  <ActionCard title="My Application" desc="Fill out current academic appraisal entries & upload proofs" icon="📝" color="#10b981" onClick={() => navigate('/applications')} />
                  <ActionCard title="Submission History" desc="View previous year scores & download approved PDF reports" icon="📜" color="#3b82f6" onClick={() => navigate('/history')} />
                </>
              )}

              {isHod && (
                <>
                  <ActionCard title="Pending Department Reviews" desc="Inspect & verify department faculty appraisal entries" icon="📋" color="#3b82f6" onClick={() => navigate('/reviews')} />
                  <ActionCard title="Department Analytics" desc="Visual score distribution & breakdown for your department" icon="📊" color="#10b981" onClick={() => navigate('/analytics')} />
                </>
              )}

              {isPrincipal && (
                <>
                  <ActionCard title="Principal Review Dashboard" desc="Final approval of faculty appraisals & review decisions" icon="👔" color="#8b5cf6" onClick={() => navigate('/principal-review')} />
                  <ActionCard title="Institutional Analytics & Graphs" desc="Cross-department comparisons & top performer insights" icon="📈" color="#3b82f6" onClick={() => navigate('/analytics')} />
                  <ActionCard title="Institutional Reports" desc="Generate and download institution appraisal reports" icon="📋" color="#10b981" onClick={() => navigate('/reports')} />
                </>
              )}

              {user.role === 'REVIEWER' && (
                <ActionCard title="Assigned Peer Reviews" desc="Evaluate assigned faculty appraisals and verify entries" icon="📋" color="#f59e0b" onClick={() => navigate('/reviews')} />
              )}

              {user.role === 'CHAIRMAN_REVIEWER' && (
                <ActionCard title="Chairman Assigned Reviews" desc="Evaluate reviewed faculty appraisals and submit recommendations" icon="🎖️" color="#ec4899" onClick={() => navigate('/reviews')} />
              )}

              {user.role === 'ACCOUNTS' && (
                <ActionCard title="Approved Increments" desc="Process financial increments & frozen appraisal reports" icon="💰" color="#6366f1" onClick={() => navigate('/accounts')} />
              )}
            </div>
          </div>

          {/* 4. Recent Submissions / Activity Section */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  📑 Recent Appraisal Activity
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Latest applications submitted in the system
                </p>
              </div>

              {['ADMIN', 'PRINCIPAL', 'HOD'].includes(user.role) && (
                <button
                  type="button"
                  onClick={() => navigate('/analytics')}
                  style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', fontWeight: 600, color: '#6366f1' }}
                >
                  View All in Analytics →
                </button>
              )}
            </div>

            {recentApps.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No recent appraisal applications found.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '12px 14px' }}>Faculty Name</th>
                      <th style={{ padding: '12px 14px' }}>Department</th>
                      <th style={{ padding: '12px 14px' }}>Academic Year</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Original Score</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Reviewer Score</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>* Bonus</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Final Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentApps.map((app: any) => (
                      <tr key={app.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {app.faculty?.name || user.name}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                          {app.faculty?.department?.name || user.department?.name || 'N/A'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>{app.academic_year}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}>
                            {app.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>
                          {app.total_score != null ? Number(app.total_score).toFixed(1) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>
                          {app.reviewer_score != null ? Number(app.reviewer_score).toFixed(1) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#ec4899' }}>
                          {app.bonus_score != null ? Number(app.bonus_score).toFixed(1) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>
                          {app.final_score != null 
                            ? Number(app.final_score).toFixed(1) 
                            : (app.reviewer_score != null ? Number(app.reviewer_score).toFixed(1) : (app.total_score != null ? Number(app.total_score).toFixed(1) : '—'))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Developer Credit Banner */}
          <div style={{ marginTop: '2.5rem', paddingTop: '1.2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div>
              <span>Developed for Ramaiah Institute of Technology by </span>
              <a href="https://www.linkedin.com/in/sm-manish/" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700 }}>
                Manish S M 🔗
              </a>
              <span> &amp; </span>
              <a href="https://www.linkedin.com/in/deepikaprofile/" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700 }}>
                Deepika T 🔗
              </a>
            </div>
            <div>
              Under guidance of <strong>Dr. Geetha J</strong> &amp; <strong>Dr. Sowmya B J</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, sub }: { label: string; value: number; icon: string; color: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

function ActionCard({ title, desc, icon, color, onClick }: { title: string; desc: string; icon: string; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: `4px solid ${color}`,
        borderRadius: '12px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '1.8rem' }}>{icon}</span>
        <span style={{ color, fontSize: '1.2rem', fontWeight: 700 }}>→</span>
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>{desc}</p>
    </div>
  );
}
