import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchPhotoById, getImageUrl, editPhoto, EditPhotoPayload } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Photo } from '../types';
import {
  Crop,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  Pencil,
  Check,
  X,
  ArrowLeft,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface CropRect {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

const DEFAULT_CROP: CropRect = {
  xPercent: 10,
  yPercent: 10,
  widthPercent: 80,
  heightPercent: 80,
};

export const ImageEditView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Photo state
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit transformation state
  const [rotation, setRotation] = useState(0); // Cumulative rotation in ±90° steps for smooth CSS animation
  const [flipH, setFlipH] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<CropRect>(DEFAULT_CROP);
  const [hasCropped, setHasCropped] = useState(false);

  // Saving state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Dragging crop box state
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragModeRef = useRef<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialCrop: CropRect } | null>(null);

  // Load photo
  useEffect(() => {
    async function loadPhoto() {
      if (!id) return;
      try {
        const data = await fetchPhotoById(id);
        setPhoto(data);
        setTitle(data.title || '');
      } catch (err: any) {
        setError(err.message || 'Unable to retrieve image details.');
      } finally {
        setLoading(false);
      }
    }
    loadPhoto();
  }, [id]);

  // Check authorization: ONLY the uploader can edit
  const isUploader = Boolean(
    user && photo && (photo.user?.id === user.id || photo.userId === user.id)
  );

  // Rotate handlers: step in natural -90° / +90° increments so CSS rotates in the intended direction
  const handleRotateLeft = () => {
    setRotation((prev) => prev - 90);
  };

  const handleRotateRight = () => {
    setRotation((prev) => prev + 90);
  };

  // Flip handler
  const handleFlipHorizontal = () => {
    setFlipH((prev) => !prev);
  };

  // Toggle crop
  const handleToggleCrop = () => {
    if (!isCropping) {
      setIsCropping(true);
      setHasCropped(true);
    } else {
      setIsCropping(false);
    }
  };

  // Crop drag interactions
  const handleMouseDown = (
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e',
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dragModeRef.current = mode;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialCrop: { ...crop },
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragModeRef.current || !dragStartRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const deltaXPercent = ((e.clientX - dragStartRef.current.clientX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStartRef.current.clientY) / rect.height) * 100;
      const init = dragStartRef.current.initialCrop;

      setCrop(() => {
        let { xPercent, yPercent, widthPercent, heightPercent } = { ...init };

        const mode = dragModeRef.current;
        const MIN_SIZE = 10;

        if (mode === 'move') {
          xPercent = Math.max(0, Math.min(100 - widthPercent, init.xPercent + deltaXPercent));
          yPercent = Math.max(0, Math.min(100 - heightPercent, init.yPercent + deltaYPercent));
        } else {
          // Resize handles
          if (mode?.includes('e')) {
            widthPercent = Math.max(MIN_SIZE, Math.min(100 - init.xPercent, init.widthPercent + deltaXPercent));
          }
          if (mode?.includes('s')) {
            heightPercent = Math.max(MIN_SIZE, Math.min(100 - init.yPercent, init.heightPercent + deltaYPercent));
          }
          if (mode?.includes('w')) {
            const maxW = init.xPercent + init.widthPercent;
            const newW = Math.max(MIN_SIZE, Math.min(maxW, init.widthPercent - deltaXPercent));
            widthPercent = newW;
            xPercent = maxW - newW;
          }
          if (mode?.includes('n')) {
            const maxH = init.yPercent + init.heightPercent;
            const newH = Math.max(MIN_SIZE, Math.min(maxH, init.heightPercent - deltaYPercent));
            heightPercent = newH;
            yPercent = maxH - newH;
          }
        }

        return { xPercent, yPercent, widthPercent, heightPercent };
      });
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    dragModeRef.current = null;
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Cancel handler: discard changes, return to details view
  const handleCancel = () => {
    if (!photo) {
      navigate('/');
      return;
    }
    navigate(`/photos/${photo.id}`);
  };

  // Submit handler: apply changes and navigate to public gallery
  const handleSubmit = async () => {
    if (!photo) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const normalizedRotation = (((rotation % 360) + 360) % 360);

    const payload: EditPhotoPayload = {
      title: title.trim() || photo.title,
      rotation: normalizedRotation,
      flipHorizontal: flipH,
      crop: hasCropped
        ? {
            xPercent: Math.round(crop.xPercent * 100) / 100,
            yPercent: Math.round(crop.yPercent * 100) / 100,
            widthPercent: Math.round(crop.widthPercent * 100) / 100,
            heightPercent: Math.round(crop.heightPercent * 100) / 100,
          }
        : null,
    };

    try {
      await editPhoto(photo.id, payload);
      // Navigate to public gallery so the newly edited image is immediately displayed
      navigate('/');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save edited photo.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
          <span>Loading image editor...</span>
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

  // Uploader-only guard: Show friendly unauthorized banner if not owner
  if (!isUploader) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-3xl bg-neutral-900/90 border border-red-900/40 shadow-2xl">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Edit Access Restricted</h2>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Only the uploader of this image is allowed to edit it.
          </p>
          <Link
            to={`/photos/${photo.id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Photo Details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 1. Title bar showing the title of the image on top (Click to edit) */}
      <div className="mb-6 pb-4 border-b border-neutral-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={handleCancel}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0"
            title="Cancel and return"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 max-w-xl">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
              Image Name (Click to edit)
            </span>
            <div className="relative group flex items-center">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter image title"
                className="w-full bg-neutral-900/60 hover:bg-neutral-900 focus:bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-indigo-500 rounded-xl px-3 py-1.5 pr-9 text-lg sm:text-xl font-bold text-white transition-all outline-none"
              />
              <Pencil className="w-4 h-4 text-neutral-500 group-hover:text-indigo-400 pointer-events-none absolute right-3" />
            </div>
          </div>
        </div>

        <div className="text-xs text-neutral-400 hidden sm:block shrink-0">
          {(((rotation % 360) + 360) % 360) !== 0 && (
            <span className="mr-3 font-mono text-indigo-400">
              Rotated {(((rotation % 360) + 360) % 360)}°
            </span>
          )}
          {flipH && <span className="mr-3 text-indigo-400 font-medium">Flipped</span>}
          {hasCropped && <span className="text-emerald-400 font-medium">Cropped</span>}
        </div>
      </div>

      {/* Error alert if submit fails */}
      {submitError && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs font-medium">
          {submitError}
        </div>
      )}

      {/* Main Workspace: Left Vertical Toolbar + Image Canvas Area */}
      <div className="flex flex-col sm:flex-row items-stretch gap-6">
        {/* 2. VERTICAL feature bar on the left of the image */}
        <aside className="w-full sm:w-16 shrink-0 flex flex-row sm:flex-col items-center justify-center sm:justify-start gap-2.5 p-2 rounded-2xl bg-neutral-900/90 border border-neutral-800 backdrop-blur-md shadow-lg">
          {/* Button 1: Crop */}
          <button
            type="button"
            onClick={handleToggleCrop}
            title={isCropping ? 'Disable crop box' : 'Crop image'}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${
              isCropping
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Crop className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-tighter">Crop</span>
          </button>

          {/* Button 2: Rotate Left */}
          <button
            type="button"
            onClick={handleRotateLeft}
            title="Rotate Left 90°"
            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-tighter">Left</span>
          </button>

          {/* Button 3: Rotate Right */}
          <button
            type="button"
            onClick={handleRotateRight}
            title="Rotate Right 90°"
            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <RotateCw className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-tighter">Right</span>
          </button>

          {/* Button 4: Flip Horizontal */}
          <button
            type="button"
            onClick={handleFlipHorizontal}
            title="Flip Horizontal"
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${
              flipH
                ? 'bg-neutral-800 text-indigo-400 border border-indigo-500/40'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <FlipHorizontal className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-tighter">Flip</span>
          </button>
        </aside>

        {/* 3. Image View Stage (Below Title Bar, To the Right of Feature Bar) */}
        <div className="flex-1 min-h-[460px] bg-neutral-950 rounded-2xl border border-neutral-800 overflow-hidden flex items-center justify-center p-4 select-none relative">
          <div
            ref={containerRef}
            className="relative max-w-full max-h-[65vh] flex items-center justify-center overflow-hidden"
          >
            {/* The base image transformed by rotation and flip */}
            <img
              src={getImageUrl(photo.storageKey, 'display')}
              alt={photo.title}
              draggable={false}
              style={{
                transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
                transition: 'transform 250ms ease-out',
              }}
              className="max-h-[62vh] max-w-full object-contain pointer-events-none select-none"
            />

            {/* Interactive Crop Box Overlay */}
            {isCropping && (
              <div
                className="absolute inset-0 pointer-events-auto"
                style={{
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                }}
              >
                {/* Crop Box Frame */}
                <div
                  onMouseDown={(e) => handleMouseDown('move', e)}
                  style={{
                    left: `${crop.xPercent}%`,
                    top: `${crop.yPercent}%`,
                    width: `${crop.widthPercent}%`,
                    height: `${crop.heightPercent}%`,
                  }}
                  className="absolute border-2 border-dashed border-emerald-400 cursor-move shadow-2xl bg-emerald-500/10"
                >
                  {/* Rule-of-thirds grid lines */}
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                    <div className="border-r border-b border-emerald-400/30" />
                    <div className="border-r border-b border-emerald-400/30" />
                    <div className="border-b border-emerald-400/30" />
                    <div className="border-r border-b border-emerald-400/30" />
                    <div className="border-r border-b border-emerald-400/30" />
                    <div className="border-b border-emerald-400/30" />
                    <div className="border-r border-emerald-400/30" />
                    <div className="border-r border-emerald-400/30" />
                    <div />
                  </div>

                  {/* Corner Handles */}
                  <div
                    onMouseDown={(e) => handleMouseDown('nw', e)}
                    className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-emerald-400 border border-neutral-900 cursor-nwse-resize rounded-sm shadow-md"
                  />
                  <div
                    onMouseDown={(e) => handleMouseDown('ne', e)}
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-400 border border-neutral-900 cursor-nesw-resize rounded-sm shadow-md"
                  />
                  <div
                    onMouseDown={(e) => handleMouseDown('sw', e)}
                    className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-emerald-400 border border-neutral-900 cursor-nesw-resize rounded-sm shadow-md"
                  />
                  <div
                    onMouseDown={(e) => handleMouseDown('se', e)}
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-400 border border-neutral-900 cursor-nwse-resize rounded-sm shadow-md"
                  />

                  {/* Edge Handles */}
                  <div
                    onMouseDown={(e) => handleMouseDown('n', e)}
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-emerald-400 border border-neutral-900 cursor-ns-resize rounded-sm"
                  />
                  <div
                    onMouseDown={(e) => handleMouseDown('s', e)}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-emerald-400 border border-neutral-900 cursor-ns-resize rounded-sm"
                  />
                  <div
                    onMouseDown={(e) => handleMouseDown('w', e)}
                    className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-4 bg-emerald-400 border border-neutral-900 cursor-ew-resize rounded-sm"
                  />
                  <div
                    onMouseDown={(e) => handleMouseDown('e', e)}
                    className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-4 bg-emerald-400 border border-neutral-900 cursor-ew-resize rounded-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Below the image: Green submit button and Red cancel button */}
      <div className="mt-6 pt-5 border-t border-neutral-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-3.5">
        {/* Red Cancel Button */}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>

        {/* Green Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-7 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Edits...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Submit</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ImageEditView;
