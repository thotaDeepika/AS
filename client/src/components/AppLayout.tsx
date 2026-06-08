import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import api from '../lib/api';

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrator',
  PRINCIPAL: 'Principal',
  HOD: 'Head of Department',
  FACULTY: 'Faculty',
  REVIEWER: 'Reviewer',
  ACCOUNTS: 'Accounts',
};

const roleColors: Record<string, string> = {
  ADMIN: '#ef4444',
  PRINCIPAL: '#8b5cf6',
  HOD: '#3b82f6',
  FACULTY: '#10b981',
  REVIEWER: '#f59e0b',
  ACCOUNTS: '#6366f1',
};

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['ADMIN', 'PRINCIPAL', 'HOD', 'FACULTY', 'REVIEWER', 'ACCOUNTS'] },
  { path: '/applications', label: 'My Application', icon: '📝', roles: ['FACULTY'] },
  { path: '/history', label: 'Submission History', icon: '📜', roles: ['FACULTY'] },

  { path: '/users', label: 'User Management', icon: '👥', roles: ['ADMIN'] },
  { path: '/scoring', label: 'Scoring Config', icon: '⚙️', roles: ['ADMIN'] },
  { path: '/reviews', label: 'Pending Reviews', icon: '✅', roles: ['HOD', 'REVIEWER'] },
  { path: '/assign-reviewers', label: 'Assign Reviewers', icon: '🔀', roles: ['ADMIN'] },
  { path: '/principal-review', label: 'Principal Review', icon: '👔', roles: ['PRINCIPAL'] },
  { path: '/accounts', label: 'Accounts', icon: '💰', roles: ['ACCOUNTS'] },
  { path: '/reports', label: 'Reports', icon: '📈', roles: ['ADMIN', 'PRINCIPAL', 'ACCOUNTS'] },
  { path: '/audit-logs', label: 'Audit Logs', icon: '🔍', roles: ['ADMIN'] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Password change modal state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);


  if (!user) return null;

  const filteredNav = navItems.filter(item => item.roles.includes(user.role));
  // De-duplicate paths (Faculty has 'My Application', others have 'Applications')
  const uniqueNav = filteredNav.reduce<NavItem[]>((acc, item) => {
    if (!acc.find(i => i.path === item.path)) acc.push(item);
    return acc;
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <svg width={sidebarCollapsed ? "26" : "32"} height={sidebarCollapsed ? "26" : "32"} viewBox="0 0 48 48" fill="none" style={{ transition: 'width var(--transition), height var(--transition)' }}>
              <rect width="48" height="48" rx="12" fill="url(#sg)" />
              <path d="M14 34V14h12a8 8 0 010 16H20v4h-6zm6-10h6a2 2 0 000-4h-6v4z" fill="white"/>
              <defs><linearGradient id="sg" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
            </svg>
            {!sidebarCollapsed && <span className="brand-text">RIT Appraisal</span>}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {uniqueNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="sidebar-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" style={{ background: roleColors[user.role] }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name}</span>
                <span className="sidebar-user-role" style={{ color: roleColors[user.role] }}>
                  {roleLabels[user.role]}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', width: '100%', flexDirection: sidebarCollapsed ? 'column' : 'row' }}>
            <button
              onClick={() => {
                setChangePasswordError('');
                setChangePasswordSuccess('');
                setOldPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
                setIsChangePasswordOpen(true);
              }}
              className="sidebar-action-btn"
              title="Change Password"
              style={{ flex: 1 }}
            >
              {sidebarCollapsed ? '🔑' : 'Change PW'}
            </button>
            <button onClick={handleLogout} className="sidebar-logout" title="Sign out" style={{ flex: 1 }}>
              {sidebarCollapsed ? '🚪' : 'Sign out'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            <h2 className="header-greeting">
              Welcome, {['PRINCIPAL', 'ADMIN', 'REVIEWER', 'ACCOUNTS'].includes(user.role) ? user.name : user.name.split(' ')[0]}
            </h2>
            {!['PRINCIPAL', 'ADMIN', 'REVIEWER', 'ACCOUNTS'].includes(user.role) && user.department?.name && (
              <span className="header-dept">{user.department.name}</span>
            )}
          </div>
          <div className="header-right">
            {/* Theme toggle removed */}
            <span className="header-badge" style={{ background: `${roleColors[user.role]}20`, color: roleColors[user.role], border: `1px solid ${roleColors[user.role]}40` }}>
              {roleLabels[user.role]}
            </span>
          </div>
        </header>
        <div className="main-body">
          <Outlet />
        </div>
      </main>

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <div className="modal-overlay" onClick={() => setIsChangePasswordOpen(false)}>
          <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button className="modal-close" onClick={() => setIsChangePasswordOpen(false)}>×</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setChangePasswordError('');
                setChangePasswordSuccess('');

                if (newPassword !== confirmNewPassword) {
                  setChangePasswordError('New passwords do not match.');
                  return;
                }

                setIsChangingPassword(true);
                try {
                  await api.put('/auth/change-password', {
                    currentPassword: oldPassword,
                    newPassword,
                  });
                  setChangePasswordSuccess('Password updated successfully!');
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setTimeout(() => {
                    setIsChangePasswordOpen(false);
                    setChangePasswordSuccess('');
                  }, 2000);
                } catch (err: any) {
                  setChangePasswordError(
                    err.response?.data?.error ||
                    err.response?.data?.message ||
                    'Failed to change password. Please verify current password.'
                  );
                } finally {
                  setIsChangingPassword(false);
                }
              }}
            >
              <div className="modal-body">
                {changePasswordError && (
                  <div className="login-error" style={{ margin: 0 }} role="alert">
                    <span>{changePasswordError}</span>
                  </div>
                )}
                {changePasswordSuccess && (
                  <div className="login-success-banner" style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <span>{changePasswordSuccess}</span>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="oldPassword">Current Password</label>
                  <input
                    id="oldPassword"
                    type="password"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirmNewPassword">Confirm New Password</label>
                  <input
                    id="confirmNewPassword"
                    type="password"
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsChangePasswordOpen(false)}
                  disabled={isChangingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

