import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { LicenseInfo } from '@mui/x-license';
import { theme } from './theme';

// MUI X Pro license (same key as the Margin app). Without it the DataGrid shows
// a watermark but still works.
const muiLicense = import.meta.env.VITE_MUI_X_LICENSE as string | undefined;
if (muiLicense) LicenseInfo.setLicenseKey(muiLicense);
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { LibraryPage } from './pages/LibraryPage';
import { OverviewPage } from './pages/OverviewPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { CollectionDetailPage } from './pages/CollectionDetailPage';
import { GuidelinesPage } from './pages/GuidelinesPage';
import { SharesPage } from './pages/SharesPage';
import { MembersPage } from './pages/MembersPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { SharePublicPage } from './pages/SharePublicPage';
import { BrandPortalPage } from './pages/BrandPortalPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Public share pages — no auth. */}
          <Route path="/s/:token" element={<SharePublicPage />} />
          {/* Public brand portal — no auth. */}
          <Route path="/brand/:brand" element={<BrandPortalPage />} />
          {/* Authenticated app. */}
          <Route
            path="/*"
            element={(
              <AuthGate>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<LibraryPage />} />
                    <Route path="/overview" element={<OverviewPage />} />
                    <Route path="/collections" element={<CollectionsPage />} />
                    <Route path="/collections/:id" element={<CollectionDetailPage />} />
                    <Route path="/guidelines" element={<GuidelinesPage />} />
                    <Route path="/shares" element={<SharesPage />} />
                    <Route path="/members" element={<MembersPage />} />
                    <Route path="/maintenance" element={<MaintenancePage />} />
                    <Route path="/api" element={<ApiDocsPage />} />
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
