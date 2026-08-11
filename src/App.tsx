import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import LessonIntro from './pages/LessonIntro';
import Lesson from './pages/Lesson';
import LessonResults from './pages/LessonResults';
import Profile from './pages/Profile';
import { useUserStore } from './store/useUserStore';

function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const onboarded = useUserStore((s) => s.onboarded);
  if (!onboarded) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        path="/home"
        element={
          <RequireOnboarded>
            <Home />
          </RequireOnboarded>
        }
      />
      <Route
        path="/lesson/:lessonId/intro"
        element={
          <RequireOnboarded>
            <LessonIntro />
          </RequireOnboarded>
        }
      />
      <Route
        path="/lesson/:lessonId"
        element={
          <RequireOnboarded>
            <Lesson />
          </RequireOnboarded>
        }
      />
      <Route
        path="/lesson/:lessonId/results"
        element={
          <RequireOnboarded>
            <LessonResults />
          </RequireOnboarded>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireOnboarded>
            <Profile />
          </RequireOnboarded>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
