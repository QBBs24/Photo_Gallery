import { GalleryResponse, Photo, UploadResponse, User } from '../types';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('gallery_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchGallery(page = 1, limit = 12): Promise<GalleryResponse> {
  const res = await fetch(`${API_BASE}/photos?page=${page}&limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load gallery photos.');
  }
  return res.json();
}

export async function fetchPhotoById(id: string): Promise<Photo> {
  const res = await fetch(`${API_BASE}/photos/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Photo not found.');
  }
  const data = await res.json();
  return data.photo;
}

export async function deletePhoto(id: string): Promise<void> {
  const headers = getAuthHeader();
  const res = await fetch(`${API_BASE}/photos/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete photo.');
  }
}

export interface EditPhotoPayload {
  rotation?: number;
  flipHorizontal?: boolean;
  crop?: {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  } | null;
}

export async function editPhoto(
  id: string,
  payload: EditPhotoPayload
): Promise<{ success: boolean; photo: Photo }> {
  const headers = {
    ...getAuthHeader(),
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${API_BASE}/photos/${id}/edit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to edit photo.');
  }
  return res.json();
}

export async function uploadPhotos(
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/photos/upload`);

    const authHeaders = getAuthHeader();
    if (authHeaders.Authorization) {
      xhr.setRequestHeader('Authorization', authHeaders.Authorization);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(response);
        } else {
          reject(new Error(response.error || `Upload failed with status ${xhr.status}`));
        }
      } catch {
        reject(new Error('An unexpected server error occurred during upload.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during image upload.'));
    };

    xhr.send(formData);
  });
}

export function getImageUrl(storageKey: string, variant: string): string {
  return `${API_BASE}/images/${storageKey}/${variant}`;
}

export async function getCurrentUser(): Promise<User | null> {
  const headers = getAuthHeader();
  if (!headers.Authorization) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}
