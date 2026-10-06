import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import { Button, EmptyState, ErrorState, Spinner } from './components/ui';
import AuthPage from './pages/AuthPage';
import Jobs from './pages/seeker/Jobs';
import JobDetails from './pages/seeker/JobDetails';
import Profile from './pages/seeker/Profile';
import Applications from './pages/seeker/Applications';
import EmployerOverview from './pages/employer/EmployerOverview';
import EmployerJobs from './pages/employer/EmployerJobs';
import Applicants from './pages/employer/Applicants';
import CompanyProfile from './pages/employer/CompanyProfile';

function Protected({ role }) {
  const { user, loading, error, refreshUser } = useAuth();
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={refreshUser} />;
  if (!user) return <Navigate to={`/auth/${role}/login`} replace />;
  if (user.role !== role) return <Navigate to={user.role === 'employer' ? '/employer' : '/'} replace />;
  return <Outlet />;
}
function JobHome() { const { user } = useAuth(); return user?.role === 'employer' ? <Navigate to="/employer" replace /> : <Jobs />; }
export default function App() {
  return <BrowserRouter><ToastProvider><AuthProvider><Routes>
    <Route path="/auth/:role/:mode" element={<AuthPage />} />
    <Route element={<Layout />}>
      <Route path="/" element={<JobHome />} />
      <Route path="/jobs/:id" element={<JobDetails />} />
      <Route element={<Protected role="seeker" />}><Route path="/seeker" element={<Navigate to="/" replace />} /><Route path="/seeker/profile" element={<Profile />} /><Route path="/seeker/applications" element={<Applications />} /></Route>
      <Route element={<Protected role="employer" />}><Route path="/employer" element={<EmployerOverview />} /><Route path="/employer/jobs" element={<EmployerJobs />} /><Route path="/employer/applicants" element={<Applicants />} /><Route path="/employer/company" element={<CompanyProfile />} /></Route>
      <Route path="*" element={<EmptyState title="This page has moved on." description="Your next opportunity is still out there."><Button>Browse jobs</Button></EmptyState>} />
    </Route>
  </Routes></AuthProvider></ToastProvider></BrowserRouter>;
}
