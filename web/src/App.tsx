import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './api/client';
import { AppShell } from './components/AppShell';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { BuildSchedulePage } from './pages/BuildSchedulePage';
import { LoginPage } from './pages/LoginPage';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProfilePage } from './pages/ProfilePage';
import { SchedulePage } from './pages/SchedulePage';
import { SeriesDetailPage } from './pages/SeriesDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { hasCompletedOnboarding } from './utils/onboarding';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  if (!hasCompletedOnboarding()) return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        element={
          <RequireAuth>
            <RequireOnboarding>
              <AppShell />
            </RequireOnboarding>
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/schedule/build" element={<BuildSchedulePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/settings" element={<SettingsPage />} />
        <Route path="/profile/history" element={<HistoryPage />} />
        <Route path="/movies/:movieId" element={<MovieDetailPage />} />
        <Route path="/series/:seriesId" element={<SeriesDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
