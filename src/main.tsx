import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { LibraryPage } from './pages/LibraryPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { CollectionDetailPage } from './pages/CollectionDetailPage';
import { SharesPage } from './pages/SharesPage';
import { MembersPage } from './pages/MembersPage';
import { SharePublicPage } from './pages/SharePublicPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Public share pages — no auth. */}
          <Route path="/s/:token" element={<SharePublicPage />} />
          {/* Authenticated app. */}
          <Route
            path="/*"
            element={(
              <AuthGate>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<LibraryPage />} />
                    <Route path="/collections" element={<CollectionsPage />} />
                    <Route path="/collections/:id" element={<CollectionDetailPage />} />
                    <Route path="/shares" element={<SharesPage />} />
                    <Route path="/members" element={<MembersPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppShell>
              </AuthGate>
            )}
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
