import { useRef, type ReactNode } from 'react';
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
import { Deathmatch } from './screens/Deathmatch';
import { Inventory } from './screens/Inventory';
import { BuildScreen } from './screens/BuildScreen';

/** Redirects to onboarding until a character exists. */
function RequireCharacter({ children }: { children: ReactNode }) {
  const { data, loading } = useQuery(getCharacter);
  if (loading) return null;
  if (!data) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Redirects only when a character already existed on arrival: creating one mid-flow must not cut the initial box short. */
function OnboardingGate() {
  const { data, loading } = useQuery(getCharacter);
  const hadCharacter = useRef<boolean | null>(null);
  if (loading) return null;
  if (hadCharacter.current === null) hadCharacter.current = Boolean(data);
  if (hadCharacter.current) return <Navigate to="/lobby" replace />;
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
              <Training />
            </RequireCharacter>
          }
        />
        <Route
          path="/dm"
          element={
            <RequireCharacter>
              <Deathmatch />
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
        <Route
          path="/inventario"
          element={
            <RequireCharacter>
              <Inventory />
            </RequireCharacter>
          }
        />
        <Route
          path="/build"
          element={
            <RequireCharacter>
              <BuildScreen />
            </RequireCharacter>
          }
        />
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
