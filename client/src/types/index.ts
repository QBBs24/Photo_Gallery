export interface User {
  id: string;
  username: string;
  email: string;
}

export interface ImageSegmentMeta {
  index: number;
  key: string;
  top: number;
  height: number;
  width: number;
}

export interface Photo {
  id: string;
  storageKey: string;
  title: string;
  description?: string | null;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  aspectRatio: number;
  variants: {
    original: string;
    medium: string;
    thumb: string;
    segmentation?: {
      isSegmented: boolean;
      segmentCount: number;
      segments: ImageSegmentMeta[];
    };
  };
  userId?: string | null;
  user?: {
    id: string;
    username: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadEvidence {
  index: number;
  id: string;
  status: 'success';
  originalFileName: string;
  storageKey: string;
  title: string;
  dimensions: {
    width: number;
    height: number;
    aspectRatio: number;
  };
  sizeBytes: number;
  format: string;
  variants: {
    original: string;
    medium: string;
    thumb: string;
  };
}

export interface UploadResponse {
  success: boolean;
  message: string;
  evidence: UploadEvidence[];
}

export interface GalleryResponse {
  photos: Photo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    nextPage: number | null;
  };
}
