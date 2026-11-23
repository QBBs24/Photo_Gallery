import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchPhotoById, getImageUrl } from '../services/api';
import { Photo } from '../types';
import { FlickrLightbox } from '../components/FlickrLightbox';
import {
  Maximize2,
  Calendar,
  HardDrive,
  Maximize,
  ArrowLeft,
  FileCheck2,
  Share2,
  Loader2,
} from 'lucide-react';

export const ImageDetailsView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadPhoto() {
      if (!id) return;
      try {
        const data = await fetchPhotoById(id);
        setPhoto(data);
      } catch (err: any) {
        setError(err.message || 'Unable to retrieve image details.');
      } finally {
        setLoading(false);
      }
    }
    loadPhoto();
  }, [id]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
          <span>Loading image details...</span>
        </div>
      </div>
    );
  }

  if (error || !photo) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Photo Not Found</h2>
        <p className="text-sm text-neutral-400 mb-6">{error || 'This photo does not exist.'}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Gallery
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{copied ? 'Link Copied!' : 'Share'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Image Stage (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative group bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center min-h-[400px]">
            <img
              src={getImageUrl(photo.storageKey, 'medium')}
              alt={photo.title}
              className="w-full max-h-[70vh] object-contain cursor-pointer transition-transform duration-300 group-hover:scale-[1.01]"
              onClick={() => setLightboxOpen(true)}
            />

            {/* Expand to Full-Screen Action Button (Flickr Style) */}
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xl backdrop-blur-md border border-neutral-700/50 transition-all hover:scale-105 active:scale-95"
            >
              <Maximize2 className="w-4 h-4 text-pink-500" />
              <span>Expand to Full Screen</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500 px-2">
            <span>Tip: Click on the image to open the Flickr-style lightbox</span>
            <Link
              to={`/photos/${photo.id}/fullscreen`}
              className="text-pink-400 hover:text-pink-300 font-medium"
            >
              Open dedicated full-screen view →
            </Link>
          </div>
        </div>

        {/* Sidebar Metadata (Right 1 column) */}
        <div className="space-y-6">
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">{photo.title}</h1>
              {photo.description && (
                <p className="text-sm text-neutral-300 leading-relaxed">{photo.description}</p>
              )}
            </div>

            {/* Uploader Card */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800/80">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {(photo.user?.username || 'A')[0].toUpperCase()}
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-neutral-500 block">
                  Photographer
                </span>
                <span className="text-sm font-medium text-white">
                  {photo.user?.username ? `@${photo.user.username}` : 'Anonymous Contributor'}
                </span>
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs uppercase font-bold tracking-wider text-neutral-400">
                Image Specifications
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
                    <Maximize className="w-3.5 h-3.5 text-blue-400" />
                    <span>Resolution</span>
                  </div>
                  <div className="font-mono font-semibold text-white">
                    {photo.width} × {photo.height}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Format</span>
                  </div>
                  <div className="font-mono font-semibold text-emerald-400 uppercase">
                    WebP (Converted)
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
                    <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                    <span>File Size</span>
                  </div>
                  <div className="font-mono font-semibold text-white">
                    {(photo.fileSizeBytes / 1024).toFixed(1)} KB
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>Uploaded</span>
                  </div>
                  <div className="font-medium text-white truncate">
                    {new Date(photo.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Storage Key Constraint Demonstration */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                  Server Storage Key Code (No absolute path stored)
                </span>
                <span className="font-mono text-neutral-300 break-all select-all text-[11px]">
                  {photo.storageKey}
                </span>
              </div>
            </div>

            {/* Action Trigger */}
            <button
              onClick={() => setLightboxOpen(true)}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 hover:opacity-95 text-white shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Full Screen Lightbox</span>
            </button>
          </div>
        </div>
      </div>

      {/* Flickr Lightbox */}
      <FlickrLightbox
        photos={[photo]}
        currentIndex={0}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={() => {}}
      />
    </div>
  );
};
