import { Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { AdminQueuePage } from './pages/AdminQueuePage';
import { BuilderPage } from './pages/BuilderPage';
import { DeckPage } from './pages/DeckPage';
import { HomePage } from './pages/HomePage';
import { MyDecksPage } from './pages/MyDecksPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="build" element={<BuilderPage />} />
        <Route path="build/:id" element={<BuilderPage />} />
        <Route path="decks/:id" element={<DeckPage />} />
        <Route path="my" element={<MyDecksPage />} />
        <Route path="users/:id" element={<ProfilePage />} />
        <Route path="admin/pro-queue" element={<AdminQueuePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
