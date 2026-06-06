import { useEffect, useState } from 'react';
import { usersApi, departmentsApi, adminApi } from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  designation: string | null;
  is_active: boolean;
  joining_date: string | null;
  created_at: string;
  department: { id: string; name: string; code: string };
}

interface Department {
  id: string;
  name: string;
  code: string;
}

const ROLES = ['FACULTY', 'HOD', 'REVIEWER', 'PRINCIPAL', 'ADMIN', 'ACCOUNTS'];
const DESIGNATIONS = ['ASSISTANT_PROFESSOR', 'ASSOCIATE_PROFESSOR', 'PROFESSOR'];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'FACULTY', designation: '', department_id: '', password: '', joining_date: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '15' };
      if (filterRole) params.role = filterRole;
      if (filterDept) params.department_id = filterDept;
      const res = await usersApi.list(params);
      setUsers(res.data.data.users || []);
      setPagination(res.data.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await departmentsApi.list();
      setDepartments(res.data.data.departments || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadDepartments(); }, []);
  useEffect(() => { loadUsers(1); }, [filterRole, filterDept]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({ email: '', name: '', role: 'FACULTY', designation: '', department_id: departments[0]?.id || '', password: '', joining_date: '' });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      name: user.name,
      role: user.role,
      designation: user.designation || '',
      department_id: user.department.id,
      password: '',
      joining_date: user.joining_date ? new Date(user.joining_date).toISOString().split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, {
          name: form.name,
          role: form.role,
          designation: ['FACULTY', 'HOD', 'REVIEWER', 'PRINCIPAL'].includes(form.role) && form.designation ? form.designation : null,
          department_id: form.department_id,
          joining_date: form.joining_date ? new Date(form.joining_date).toISOString() : null,
        });
        showToast('success', `User "${form.name}" updated successfully`);
      } else {
        await usersApi.create({
          email: form.email,
          name: form.name,
          role: form.role,
          designation: ['FACULTY', 'HOD', 'REVIEWER', 'PRINCIPAL'].includes(form.role) && form.designation ? form.designation : null,
          department_id: form.department_id,
          joining_date: form.joining_date ? new Date(form.joining_date).toISOString() : null,
          password: form.password || undefined,
        });
        showToast('success', `User "${form.name}" created successfully`);
      }
      setShowModal(false);
      loadUsers(pagination.page);
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await usersApi.update(user.id, { is_active: !user.is_active });
      showToast('success', `User "${user.name}" ${user.is_active ? 'deactivated' : 'activated'}`);
      loadUsers(pagination.page);
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleOverride = async (userRecord: User, action: 'EDIT' | 'OPEN') => {
    const actionText = action === 'EDIT' ? 'force edit an existing application' : 'open a new application early';
    if (!confirm(`Are you sure you want to ${actionText} for ${userRecord.name}?`)) return;
    try {
      const res = await adminApi.overrideApplication(userRecord.id, action);
      showToast('success', res.data.message || 'Action completed successfully');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || `Failed to ${action === 'EDIT' ? 'override application access' : 'open new application'}`);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: User) => (
        <div className="cell-faculty">
          <span className="cell-name">{row.name}</span>
          <span className="cell-sub">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row: User) => <StatusBadge status={row.role} size="sm" />,
    },
    {
      key: 'department',
      header: 'Department',
      render: (row: User) => (
        <span className="dept-chip">{row.department.code}</span>
      ),
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (row: User) => row.designation ? row.designation.replace(/_/g, ' ') : '—',
    },
    {
      key: 'joining_date',
      header: 'Joining Date',
      render: (row: User) => row.joining_date ? new Date(row.joining_date).toLocaleDateString() : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: User) => (
        <span className={`status-dot ${row.is_active ? 'active' : 'inactive'}`}>
          {row.is_active ? '● Active' : '● Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '160px',
      render: (row: User) => (
        <div className="cell-actions">
          <button className="btn-small" onClick={() => openEditModal(row)}>Edit</button>
          <button
            className={`btn-small ${row.is_active ? 'btn-danger' : 'btn-success'}`}
            onClick={() => toggleActive(row)}
          >
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
          {row.role === 'FACULTY' && (
            <>
              <button
                className="btn-small btn-secondary"
                title="Force open editing for an existing application"
                onClick={() => handleOverride(row, 'EDIT')}
                style={{ marginLeft: '4px' }}
              >
                Allow App Edit
              </button>
              <button
                className="btn-small btn-secondary"
                title="Open a new application for the user early"
                onClick={() => handleOverride(row, 'OPEN')}
                style={{ marginLeft: '4px' }}
              >
                Open App
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="users-page">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.type === 'success' ? '✓' : '✕'} {toast.msg}</div>}

      <div className="page-title">
        <div>
          <h2>User Management</h2>
          <p>Create, edit, and manage user accounts across all roles</p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>+ Create User</button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
        </select>
        <span className="filter-count">{pagination.total} users</span>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchable
        searchPlaceholder="Search by name or email..."
        loading={loading}
        emptyMessage="No users found"
        pagination={{
          page: pagination.page,
          pages: pagination.pages,
          total: pagination.total,
          onPageChange: (p) => loadUsers(p),
        }}
      />

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {!editingUser && (
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="user@rit.edu"
                  />
                </div>
              )}
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Dr. John Doe"
                />
              </div>
              <div className="form-group">
                <label>Joining Date</label>
                <input
                  type="date"
                  value={form.joining_date}
                  onChange={e => setForm({ ...form, joining_date: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              {['FACULTY', 'HOD', 'REVIEWER', 'PRINCIPAL'].includes(form.role) && (
                <div className="form-group">
                  <label>Designation</label>
                  <select value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })}>
                    <option value="">Select Designation</option>
                    {DESIGNATIONS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              )}
              {!editingUser && (
                <div className="form-group">
                  <label>Password <span className="hint">(default: Admin@123)</span></label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Leave blank for default"
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name || !form.department_id || (!editingUser && !form.email)}>
                {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
