import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import Landing from './pages/Landing';
import Guide from './pages/Guide';
import Shop from './pages/Shop';
import Achievements from './pages/Achievements';
import AvatarEditor from './pages/AvatarEditor';
import Missions from './pages/Missions';
import Login from './pages/Login';
import Friends from './pages/Friends';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import LessonIntro from './pages/LessonIntro';
import Lesson from './pages/Lesson';
import LessonResults from './pages/LessonResults';
import Profile from './pages/Profile';
import { useUserStore } from './store/useUserStore';
import { useSyncStore } from './store/useSyncStore';
import { useCloudSync } from './hooks/useCloudSync';
import { useStreakReminders } from './hooks/useStreakReminders';
import RegisterGate from './components/RegisterGate';
import PingBanner from './components/PingBanner';
import { useAuthStore } from './store/useAuthStore';

function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const onboarded = useUserStore((s) => s.onboarded);
  const settled = useSyncStore((s) => s.status !== 'connecting');

  // Nothing is known yet on a device that has never run the app, so deciding
  // now would bounce a perfectly good account to the landing page a moment
  // before its profile arrives. The splash is covering this anyway.
  if (!settled && !onboarded) return null;

  if (!onboarded) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  // App mounts once per launch, so this runs on cold start only — not on
  // navigation between routes.
  const [booting, setBooting] = useState(true);
  // Signs in anonymously and mirrors progress to Supabase. With no keys
  // configured this is inert and the app stays purely local. The splash is
  // already 10 seconds, which comfortably covers the first pull.
  useCloudSync();
  useStreakReminders();

  // Watches the session so the nag knows whether this account is anonymous.
  const initAuth = useAuthStore((s) => s.init);
  useEffect(() => initAuth(), [initAuth]);

  return (
    <>
      {booting && <SplashScreen onDone={() => setBooting(false)} />}
      {!booting && <RegisterGate />}
      {!booting && <PingBanner />}
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/entrar" element={<Login />} />
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
        path="/guia"
        element={
          <RequireOnboarded>
            <Guide />
          </RequireOnboarded>
        }
      />
      <Route
        path="/tienda"
        element={
          <RequireOnboarded>
            <Shop />
          </RequireOnboarded>
        }
      />
      <Route
        path="/logros"
        element={
          <RequireOnboarded>
            <Achievements />
          </RequireOnboarded>
        }
      />
      <Route
        path="/avatar"
        element={
          <RequireOnboarded>
            <AvatarEditor />
          </RequireOnboarded>
        }
      />
      <Route
        path="/amigos"
        element={
          <RequireOnboarded>
            <Friends />
          </RequireOnboarded>
        }
      />
      <Route
        path="/misiones"
        element={
          <RequireOnboarded>
            <Missions />
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
    </>
  );
}

export default App;
