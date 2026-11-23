import React, { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Photo } from '../types';
import { getImageUrl } from '../services/api';

interface FlickrLightboxProps {
  photos: Photo[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const FlickrLightbox: React.FC<FlickrLightboxProps> = ({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const currentPhoto = photos[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      onNavigate(currentIndex + 1);
      setIsZoomed(false);
    }
  }, [currentIndex, photos.length, onNavigate]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
      setIsZoomed(false);
    }
  }, [currentIndex, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'z' || e.key === 'Z') {
        setIsZoomed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  // Lock body scroll when lightbox is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsZoomed(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !currentPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/98 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      {/* Top Header Bar */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-neutral-900/80 bg-neutral-950/70 z-10">
        <div className="flex items-center gap-4 text-sm text-neutral-300">
          <span className="font-semibold text-white tracking-wide truncate max-w-xs sm:max-w-md">
            {currentPhoto.title}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors"
            title={isZoomed ? 'Zoom Out (Z)' : 'Zoom In (Z)'}
          >
            {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2.5 rounded-xl transition-colors ${
              showInfo ? 'text-blue-400 bg-neutral-800' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/80'
            }`}
            title="Image Details"
          >
            <Info className="w-5 h-5" />
          </button>

          <div className="h-5 w-[1px] bg-neutral-800 mx-1" />

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-950/20 transition-colors"
            title="Exit Fullscreen (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Full-screen Canvas */}
      <div className="relative flex-1 flex items-center justify-center overflow-auto p-4 sm:p-8">
        {/* Navigation Arrow - Left */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white/70 hover:text-white shadow-xl backdrop-blur-md transition-all hover:scale-110"
            title="Previous Photo (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Navigation Arrow - Right */}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white/70 hover:text-white shadow-xl backdrop-blur-md transition-all hover:scale-110"
            title="Next Photo (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* The Image */}
        <div
          className={`flex items-center justify-center transition-all duration-300 ${
            isZoomed ? 'cursor-zoom-out min-w-full min-h-full' : 'cursor-zoom-in max-w-full max-h-full'
          }`}
          onClick={() => setIsZoomed(!isZoomed)}
        >
          <img
            src={getImageUrl(currentPhoto.storageKey, 'original')}
            alt={currentPhoto.title}
            className={`rounded-sm shadow-2xl transition-all duration-300 object-contain ${
              isZoomed
                ? 'max-w-none scale-125 my-8'
                : 'max-h-[calc(100vh-8rem)] max-w-[calc(100vw-4rem)]'
            }`}
            loading="eager"
          />
        </div>

        {/* Metadata Sidebar Overlay (Flickr Style) */}
        {showInfo && (
          <div className="absolute right-6 top-6 bottom-6 w-80 bg-neutral-900/95 backdrop-blur-2xl border border-neutral-800 rounded-2xl p-6 overflow-y-auto shadow-2xl z-30 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-4">
              <h3 className="font-bold text-white text-base">Photo Information</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                  Title
                </span>
                <p className="text-white text-sm font-medium">{currentPhoto.title}</p>
              </div>

              <div>
                <span className="text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                  Uploader
                </span>
                <p className="text-neutral-200">
                  {currentPhoto.user?.username ? `@${currentPhoto.user.username}` : 'Anonymous / Public'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                    Dimensions
                  </span>
                  <p className="text-neutral-200 font-mono">
                    {currentPhoto.width} × {currentPhoto.height}
                  </p>
                </div>
                <div>
                  <span className="text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                    Aspect Ratio
                  </span>
                  <p className="text-neutral-200 font-mono">{currentPhoto.aspectRatio}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                    Storage Format
                  </span>
                  <p className="text-emerald-400 font-semibold uppercase">WebP</p>
                </div>
                <div>
                  <span className="text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                    File Size
                  </span>
                  <p className="text-neutral-200 font-mono">
                    {(currentPhoto.fileSizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <div>
                <span className="text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                  Uploaded
                </span>
                <p className="text-neutral-300">
                  {new Date(currentPhoto.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="pt-2 border-t border-neutral-800">
                <span className="text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                  Storage Key
                </span>
                <p className="text-neutral-400 font-mono text-[11px] break-all bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                  {currentPhoto.storageKey}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="h-10 px-6 flex items-center justify-between text-[11px] text-neutral-500 border-t border-neutral-900 bg-neutral-950/70">
        <div>
          Use <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">←</kbd>{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">→</kbd> to navigate,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">Z</kbd> to zoom
        </div>
        <div>
          Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">Esc</kbd> to exit
        </div>
      </div>
    </div>
  );
};
