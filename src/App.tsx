import { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import UserManagement from './components/UserManagement';
import IndicatorManagement from './components/IndicatorManagement';
import EvaluationDashboard from './components/EvaluationDashboard';
import ProjectManagement from './components/ProjectManagement';
import Profile from './components/Profile';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import AppManagement from './components/AppManagement';
import ScheduleManagement from './components/ScheduleManagement';
import DeadlineNotifier from './components/DeadlineNotifier';

const AppRoute = ({ children, roles, hideLayout }: { children: ReactNode, roles?: string[], hideLayout?: boolean }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isDefaultAdmin = user?.email === 'nguyen.haidangday@gmail.com';
  const isPending = profile?.status === 'pending' && !isDefaultAdmin;

  if (!user || isPending) return <Auth />;

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/" />;
  }

  if (hideLayout) return <>{children}</>;

  return (
    <>
      <DeadlineNotifier />
      <Layout>{children}</Layout>
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/" element={
            <AppRoute hideLayout>
              <LandingPage />
            </AppRoute>
          } />
          <Route path="/portal" element={
            <AppRoute>
              <Dashboard />
            </AppRoute>
          } />
          <Route path="/tasks" element={
            <AppRoute>
              <TaskList />
            </AppRoute>
          } />
          <Route path="/users" element={
            <AppRoute roles={['Admin']}>
              <UserManagement />
            </AppRoute>
          } />
          <Route path="/apps" element={
            <AppRoute roles={['Admin']}>
              <AppManagement />
            </AppRoute>
          } />
          <Route path="/schedules" element={
            <AppRoute>
              <ScheduleManagement />
            </AppRoute>
          } />
          <Route path="/indicators" element={
            <AppRoute>
              <IndicatorManagement />
            </AppRoute>
          } />
          <Route path="/projects" element={
            <AppRoute>
              <ProjectManagement />
            </AppRoute>
          } />
          <Route path="/evaluation" element={
            <AppRoute>
              <EvaluationDashboard />
            </AppRoute>
          } />
          <Route path="/profile" element={
            <AppRoute>
              <Profile />
            </AppRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
