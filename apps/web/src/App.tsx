import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getCharacter } from './store/character';
import { useQuery } from './store/useQuery';
import { Lobby } from './screens/Lobby';
import { MatchScreen } from './screens/MatchScreen';
import { Onboarding } from './screens/Onboarding';
import { Profile } from './screens/Profile';
import { Queue } from './screens/Queue';
import { Result } from './screens/Result';
import { Training } from './screens/Training';

/** Redirects to onboarding until a character exists. */
function RequireCharacter({ children }: { children: ReactNode }) {
  const { data, loading } = useQuery(getCharacter);
  if (loading) return null;
  if (!data) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function OnboardingGate() {
  const { data, loading } = useQuery(getCharacter);
  if (loading) return null;
  if (data) return <Navigate to="/lobby" replace />;
  return <Onboarding />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="/onboarding" element={<OnboardingGate />} />
        <Route
          path="/lobby"
          element={
            <RequireCharacter>
              <Lobby />
            </RequireCharacter>
          }
        />
        <Route
          path="/treino"
          element={
            <RequireCharacter>
              <Training mode="treino" />
            </RequireCharacter>
          }
        />
        <Route
          path="/dm"
          element={
            <RequireCharacter>
              <Training mode="dm" />
            </RequireCharacter>
          }
        />
        <Route
          path="/queue"
          element={
            <RequireCharacter>
              <Queue />
            </RequireCharacter>
          }
        />
        <Route path="/match" element={<MatchScreen />} />
        <Route
          path="/perfil"
          element={
            <RequireCharacter>
              <Profile />
            </RequireCharacter>
          }
        />
        <Route
          path="/resultado"
          element={
            <RequireCharacter>
              <Result />
            </RequireCharacter>
          }
        />
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
