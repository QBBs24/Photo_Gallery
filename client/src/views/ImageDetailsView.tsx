import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchPhotoById, getImageUrl, deletePhoto } from '../services/api';
import { useAuth } from '../context/AuthContext';
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
  Trash2,
} from 'lucide-react';

export const ImageDetailsView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const isUploader = Boolean(
    user && photo && (photo.user?.id === user.id || photo.userId === user.id)
  );

  const handleDelete = async () => {
    if (!photo) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePhoto(photo.id);
      navigate('/');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete image. Please try again.');
      setDeleting(false);
    }
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

  const isSegmented = Boolean(
    photo.variants?.segmentation?.isSegmented &&
      photo.variants?.segmentation?.segments?.length
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation Breadcrumb: Back button returns directly to home screen */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Gallery
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
          {/* Image Display Frame */}
          <div className="relative bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center min-h-[350px]">
            {isSegmented ? (
              /* Large image rendered in 10 horizontal row-segment divs */
              <div className="flex flex-col w-full overflow-hidden select-none">
                {photo.variants.segmentation!.segments.map((_, idx) => (
                  <div key={idx} className="w-full overflow-hidden leading-none m-0 p-0">
                    <img
                      src={getImageUrl(photo.storageKey, `segment_${idx}`)}
                      alt={`${photo.title} - segment ${idx + 1}`}
                      className="w-full h-auto block m-0 p-0"
                      loading={idx < 3 ? 'eager' : 'lazy'}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* High-fidelity display WebP variant (1440px) */
              <img
                src={getImageUrl(photo.storageKey, 'display')}
                alt={photo.title}
                width={photo.width}
                height={photo.height}
                className="w-full max-h-[70vh] object-contain"
              />
            )}
          </div>

          {/* Action Button: Placed cleanly directly below the picture */}
          <div>
            <button
              onClick={() => setLightboxOpen(true)}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-pink-500/50 text-white shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <Maximize2 className="w-4 h-4 text-pink-500" />
              <span>Expand to Full Screen</span>
            </button>
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
                    WebP
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
            </div>

            {/* Delete Option for Uploader Only */}
            {isUploader && (
              <div className="pt-4 border-t border-neutral-800">
                {deleteConfirm ? (
                  <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 space-y-3">
                    <div className="text-xs text-red-200 font-medium leading-relaxed">
                      Are you sure you want to delete this image? This action permanently removes it.
                    </div>
                    {deleteError && (
                      <div className="text-xs text-red-400 font-medium">{deleteError}</div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-red-950"
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Confirm Delete</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirm(false);
                          setDeleteError(null);
                        }}
                        disabled={deleting}
                        className="py-2 px-3 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Image</span>
                  </button>
                )}
              </div>
            )}
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
