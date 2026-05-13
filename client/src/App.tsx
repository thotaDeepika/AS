import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ApplicationsPage from './pages/ApplicationsPage';
import ReviewsPage from './pages/ReviewsPage';
import UsersPage from './pages/UsersPage';
import ScoringPage from './pages/ScoringPage';
import AssignReviewersPage from './pages/AssignReviewersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import PrincipalDashboardPage from './pages/PrincipalDashboardPage';
import AccountsDashboardPage from './pages/AccountsDashboardPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="page-loader"><div className="loader-spinner" /><p>Loading...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="page-loader"><div className="loader-spinner" /><p>Loading...</p></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Placeholder for Phase 6
function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-icon">🚧</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="placeholder-badge">Coming in Phase 6</span>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      {/* Protected layout routes */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/scoring" element={<ScoringPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/assign-reviewers" element={<AssignReviewersPage />} />
        <Route path="/principal-review" element={<PrincipalDashboardPage />} />
        <Route path="/accounts" element={<AccountsDashboardPage />} />
        <Route path="/reports" element={<PlaceholderPage title="Reports" description="Generate and download PDF/Excel reports" />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
