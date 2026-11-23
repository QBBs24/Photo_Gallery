import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchGallery, getImageUrl } from '../services/api';
import { Photo } from '../types';
import { FlickrLightbox } from '../components/FlickrLightbox';
import { Image as ImageIcon, Loader2, Sparkles, Maximize2 } from 'lucide-react';

export const GalleryView: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flickr Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const observerTarget = useRef<HTMLDivElement | null>(null);

  const loadPhotos = useCallback(async (pageToLoad: number) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchGallery(pageToLoad, 12);
      setPhotos((prev) => (pageToLoad === 1 ? data.photos : [...prev, ...data.photos]));
      setHasMore(data.pagination.hasMore);
      setPage(pageToLoad);
    } catch (err: any) {
      setError(err.message || 'Failed to load gallery photos.');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    loadPhotos(1);
  }, []);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !initialLoading) {
          loadPhotos(page + 1);
        }
      },
      { threshold: 0.2, rootMargin: '200px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, page, initialLoading, loadPhotos]);

  const openLightboxAt = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Explore Gallery <Sparkles className="w-5 h-5 text-pink-500 animate-pulse" />
          </h1>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-neutral-900 border border-neutral-800 hover:border-pink-500/50 hover:bg-neutral-800 text-white transition-all shadow-sm"
        >
          Upload New Photos
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!initialLoading && photos.length === 0 && (
        <div className="text-center py-20 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/30">
          <div className="inline-flex p-4 rounded-full bg-neutral-900 text-neutral-500 mb-4">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No Photos Uploaded Yet</h3>
          <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-6">
            Be the first to share an image! Upload up to 2 images per request.
          </p>
          <Link
            to="/upload"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-pink-600 text-white shadow-lg hover:opacity-95"
          >
            Upload Now
          </Link>
        </div>
      )}

      {/* Public Gallery Grid: Pure clean grid of only images (Fixed width 320px) */}
      <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,320px)] justify-center gap-6">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="w-full sm:w-[320px] aspect-[4/3] group relative bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-800/80 hover:border-neutral-600 transition-all duration-300 hover:shadow-2xl hover:shadow-pink-950/10"
            style={{
              backgroundImage: `url(${photo.variants?.lqipDataUri ?? getImageUrl(photo.storageKey, 'lqip')})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <Link to={`/photos/${photo.id}`} className="block w-full h-full">
              <img
                src={getImageUrl(photo.storageKey, 'thumb')}
                srcSet={`${getImageUrl(photo.storageKey, 'thumb')} 400w, ${getImageUrl(photo.storageKey, 'thumb_2x')} 800w`}
                sizes="(min-width: 640px) 320px, 100vw"
                alt={photo.title || ''}
                loading="lazy"
                width={photo.width}
                height={photo.height}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </Link>

            {/* Subtle Quick Expand Button on Hover */}
            <button
              onClick={(e) => openLightboxAt(index, e)}
              className="absolute bottom-3 right-3 p-2 rounded-xl bg-neutral-950/80 hover:bg-neutral-900 text-white opacity-0 group-hover:opacity-100 backdrop-blur-md border border-neutral-800 transition-all shadow-lg hover:scale-110"
              title="Expand to Full Screen"
            >
              <Maximize2 className="w-4 h-4 text-pink-500" />
            </button>
          </div>
        ))}
      </div>

      {/* Infinite Scroll Trigger Sentinel */}
      <div ref={observerTarget} className="py-12 flex justify-center items-center">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
            Loading more photos...
          </div>
        )}
        {!hasMore && photos.length > 0 && (
          <div className="text-xs text-neutral-500 font-medium">
            You've reached the end of the gallery.
          </div>
        )}
      </div>

      {/* Flickr-Style Lightbox */}
      <FlickrLightbox
        photos={photos}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(idx) => setLightboxIndex(idx)}
      />
    </div>
  );
};
