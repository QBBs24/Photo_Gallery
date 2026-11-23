import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPhotoById } from '../services/api';
import { Photo } from '../types';
import { FlickrLightbox } from '../components/FlickrLightbox';
import { Loader2 } from 'lucide-react';

export const ImageFullScreenView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await fetchPhotoById(id);
        setPhoto(data);
      } catch {
        navigate('/');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, navigate]);

  const handleClose = () => {
    if (id) {
      navigate(`/photos/${id}`);
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!photo) return null;

  return (
    <FlickrLightbox
      photos={[photo]}
      currentIndex={0}
      isOpen={true}
      onClose={handleClose}
      onNavigate={() => {}}
    />
  );
};
