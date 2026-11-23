import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { uploadPhotos } from '../services/api';
import { UploadResponse, UploadEvidence } from '../types';
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
  FileCheck,
  ShieldAlert,
  ArrowRight,
  Info,
  Lock,
  LogIn,
  UserPlus,
} from 'lucide-react';

interface SelectedFileItem {
  file: File;
  previewUrl: string;
  title: string;
}

export const ImageUploadView: React.FC = () => {
  const { user } = useAuth();
  const [selectedItems, setSelectedItems] = useState<SelectedFileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadEvidence, setUploadEvidence] = useState<UploadEvidence[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setUploadEvidence(null);

    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;

    // Check file count
    if (selectedItems.length + incoming.length > 2) {
      setError('You can upload at most 2 pictures per request. Please remove a file or select fewer files.');
      return;
    }

    // Check size on client before upload
    for (const file of incoming) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File '${file.name}' exceeds the 10 MiB limit (${(file.size / (1024 * 1024)).toFixed(1)} MiB). Please choose a smaller image.`);
        return;
      }
    }

    const newItems: SelectedFileItem[] = incoming.map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      title: f.name.replace(/\.[^/.]+$/, ''),
    }));

    setSelectedItems((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    setSelectedItems((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
    setError(null);
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    setSelectedItems((prev) => {
      const copy = [...prev];
      copy[index].title = newTitle;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUploadEvidence(null);

    if (selectedItems.length === 0) {
      setError('Please select at least 1 image to upload (maximum 2 images allowed).');
      return;
    }

    if (selectedItems.length > 2) {
      setError('You can upload at most 2 images per request.');
      return;
    }

    // Calculate total size
    const totalSize = selectedItems.reduce((acc, curr) => acc + curr.file.size, 0);
    if (totalSize > 55 * 1024 * 1024) {
      setError('Total upload size exceeds 55 MiB. Please reduce file sizes.');
      return;
    }

    const formData = new FormData();
    selectedItems.forEach((item) => {
      formData.append('images', item.file);
    });

    const titles = selectedItems.map((item) => item.title);
    formData.append('titles', JSON.stringify(titles));

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const response: UploadResponse = await uploadPhotos(formData, (percent) => {
        setUploadProgress(percent);
      });

      setUploadEvidence(response.evidence);
      setSelectedItems([]);
    } catch (err: any) {
      setError(err.message || 'Image upload was rejected by the server.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="p-8 sm:p-10 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Registration Required</h2>
          <p className="text-sm text-neutral-400 max-w-md mx-auto mb-8 leading-relaxed">
            You must be registered and logged in to upload images to the photo gallery. Please log in to your account or register to start uploading.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Log In</span>
            </Link>
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02]"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create an Account</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Title */}
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center sm:justify-start gap-2.5">
          <Upload className="w-7 h-7 text-pink-500" />
          <span>Upload Images</span>
        </h1>
        <p className="text-sm text-neutral-400 mt-1.5">
          Upload 1 or 2 images per request. Converted to WebP and stored safely in SeaweedFS.
        </p>
      </div>

      {/* Resource Limits Notice Card */}
      <div className="mb-8 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-300 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-start gap-2.5">
          <FileCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white block">Accepted Formats</span>
            <span className="text-neutral-400">PNG, JPEG, HEIC, HEIF, TIFF, BMP</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white block">File Quantity</span>
            <span className="text-neutral-400">1 – 2 pictures per request</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white block">Size Limits</span>
            <span className="text-neutral-400">Max 10 MiB / file • 55 MiB total</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white block">Resolution Limit</span>
            <span className="text-neutral-400">Max 40 million pixels</span>
          </div>
        </div>
      </div>

      {/* Error Alert (Natural Language) */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-950/50 border border-red-800 text-red-200 text-sm flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">{error}</div>
        </div>
      )}

      {/* Evidence Card Display upon Success */}
      {uploadEvidence && (
        <div className="mb-8 p-6 rounded-2xl bg-emerald-950/30 border border-emerald-800/80 shadow-2xl animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base mb-4">
            <CheckCircle2 className="w-6 h-6" />
            <span>Upload Completed Successfully! Evidence per file index:</span>
          </div>

          <div className="space-y-4">
            {uploadEvidence.map((ev) => (
              <div
                key={ev.index}
                className="p-4 rounded-xl bg-neutral-950/80 border border-emerald-900/60 text-xs space-y-2"
              >
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-900/50 text-emerald-300 font-bold uppercase tracking-wider text-[11px]">
                    Index #{ev.index} • Status: {ev.status}
                  </span>
                  <Link
                    to={`/photos/${ev.id}`}
                    className="text-pink-400 hover:text-pink-300 font-semibold inline-flex items-center gap-1"
                  >
                    View in Details <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-neutral-300 pt-1">
                  <div>
                    <span className="text-neutral-500 block">Original Filename:</span>
                    <span className="font-medium text-white truncate block">{ev.originalFileName}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Resolution:</span>
                    <span className="font-mono text-white">
                      {ev.dimensions.width} × {ev.dimensions.height}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Storage Format:</span>
                    <span className="font-semibold text-emerald-400 uppercase">{ev.format}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Converted Size:</span>
                    <span className="font-mono text-white">
                      {(ev.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-900">
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">
                    Storage Key (Server Reference Code)
                  </span>
                  <span className="font-mono text-neutral-300 select-all break-all text-[11px]">
                    {ev.storageKey}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <Link
              to="/"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
            >
              Go to Public Gallery
            </Link>
          </div>
        </div>
      )}

      {/* Main Upload Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dropzone / Picker */}
        {selectedItems.length < 2 && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-800 hover:border-pink-500/60 rounded-3xl p-8 sm:p-12 text-center bg-neutral-900/40 hover:bg-neutral-900/70 transition-all cursor-pointer group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/png,image/jpeg,image/heic,image/heif,image/tiff,image/bmp"
              className="hidden"
            />
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-pink-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-pink-950/20 transition-all">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Select or Drop 1 to 2 Images
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Click to browse your device. Accepted: PNG, JPEG, HEIC, HEIF, TIFF, BMP.
            </p>
          </div>
        )}

        {/* Selected Images Preview List */}
        {selectedItems.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-300">
              Selected Images ({selectedItems.length}/2):
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedItems.map((item, index) => (
                <div
                  key={index}
                  className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 relative space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-neutral-950/80 hover:bg-red-950 text-neutral-400 hover:text-red-400 transition-colors z-10"
                    title="Remove Image"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="relative aspect-[16/10] bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800/60">
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-neutral-950/80 text-[10px] font-mono font-bold text-neutral-300">
                      Index #{index}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                      Title for Index #{index}
                    </label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleTitleChange(index, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="text-[11px] text-neutral-500 flex justify-between">
                    <span className="truncate max-w-[180px]">{item.file.name}</span>
                    <span className="font-mono">{(item.file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {uploadProgress !== null && (
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-neutral-300">
              <span>Uploading & Processing via Sharp...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
              <div
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-500 h-2 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        {selectedItems.length > 0 && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 hover:opacity-95 text-white shadow-xl shadow-pink-600/10 disabled:opacity-50 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Processing & Converting to WebP...'
                : `Upload ${selectedItems.length} Image${selectedItems.length > 1 ? 's' : ''}`}
            </span>
          </button>
        )}
      </form>
    </div>
  );
};
