import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';

// 7 Views
import { RegisterView } from './views/RegisterView';
import { LoginView } from './views/LoginView';
import { PasswordResetView } from './views/PasswordResetView';
import { GalleryView } from './views/GalleryView';
import { ImageDetailsView } from './views/ImageDetailsView';
import { ImageFullScreenView } from './views/ImageFullScreenView';
import { ImageUploadView } from './views/ImageUploadView';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* View 1: Registration */}
              <Route path="/register" element={<RegisterView />} />

              {/* View 2: Login */}
              <Route path="/login" element={<LoginView />} />

              {/* View 3: Password Reset */}
              <Route path="/reset-password" element={<PasswordResetView />} />
              <Route path="/reset-password/:token" element={<PasswordResetView />} />

              {/* View 4: Public Gallery */}
              <Route path="/" element={<GalleryView />} />
              <Route path="/gallery" element={<GalleryView />} />

              {/* View 5: Image Details */}
              <Route path="/photos/:id" element={<ImageDetailsView />} />

              {/* View 6: Image Full-Screen (Flickr Style) */}
              <Route path="/photos/:id/fullscreen" element={<ImageFullScreenView />} />

              {/* View 7: Image Upload */}
              <Route path="/upload" element={<ImageUploadView />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
