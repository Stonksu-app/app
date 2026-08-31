import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import Landing from './pages/Landing';
import Guide from './pages/Guide';
import GuidePractice from './pages/GuidePractice';
import GuideRead from './pages/GuideRead';
import Premium from './pages/Premium';
import UltraPitch from './pages/UltraPitch';
import Simulator from './pages/Simulator';
import Shop from './pages/Shop';
import Achievements from './pages/Achievements';
import AvatarEditor from './pages/AvatarEditor';
import Missions from './pages/Missions';
import League from './pages/League';
import Login from './pages/Login';
import Friends from './pages/Friends';
import FriendProfile from './pages/FriendProfile';
import Sections from './pages/Sections';
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
import { useHeartsReminder } from './hooks/useHeartsReminder';

import RegisterGate from './components/RegisterGate';
import PingBanner from './components/PingBanner';
import { useAuthStore } from './store/useAuthStore';

function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const onboarded = useUserStore((s) => s.onboarded);
  const syncSettled = useSyncStore((s) => s.status !== 'connecting');
  const authStatus = useAuthStore((s) => s.status);
  const registered = authStatus === 'registered';

  // Both have to have answered. Nothing is known yet on a device that has
  // never run the app, so deciding early would bounce a perfectly good account
  // to the landing page a moment before its profile arrives — and deciding
  // before the session resolves would send a signed-in player to the marketing
  // page instead of to onboarding. The splash is covering this anyway.
  const settled = syncSettled && authStatus !== 'loading';
  if (!settled && !onboarded) return null;

  // Signed in, but this account never picked a nickname — a fresh one from
  // Google, or an old one that never finished. Sending it to the marketing
  // page is a dead end: they are already through the door and it offers them
  // no way forward. Onboarding is the thing they are actually missing.
  if (!onboarded) return <Navigate to={registered ? '/onboarding' : '/'} replace />;

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
  useHeartsReminder();

  // Watches the session so the nag knows whether this account is anonymous.
  const initAuth = useAuthStore((s) => s.init);
  useEffect(() => initAuth(), [initAuth]);

  // Also on a cold start, not only after a cloud read: a device that never
  // signs in can lose the pair the streak lives in just as easily, and the
  // history sitting next to it is enough to put the number back.
  useEffect(() => {
    useUserStore.getState().repairStreak();
    // A streak can die purely from time passing while the app was closed;
    // nothing else notices that until the next lesson. Settle it now so a
    // cold start shows the real number instead of the one from before the
    // gap.
    useUserStore.getState().settleStreak();
  }, []);

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
        path="/guia/repaso"
        element={
          <RequireOnboarded>
            <GuidePractice />
          </RequireOnboarded>
        }
      />
      <Route
        path="/guia/leer"
        element={
          <RequireOnboarded>
            <GuideRead />
          </RequireOnboarded>
        }
      />
      <Route
        path="/ultra"
        element={
          <RequireOnboarded>
            <UltraPitch />
          </RequireOnboarded>
        }
      />
      <Route
        path="/amigos/:id"
        element={
          <RequireOnboarded>
            <FriendProfile />
          </RequireOnboarded>
        }
      />
      <Route
        path="/simulador"
        element={
          <RequireOnboarded>
            <Simulator />
          </RequireOnboarded>
        }
      />
      <Route
        path="/planes"
        element={
          <RequireOnboarded>
            <Premium />
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
        path="/secciones"
        element={
          <RequireOnboarded>
            <Sections />
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
        path="/liga"
        element={
          <RequireOnboarded>
            <League />
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
