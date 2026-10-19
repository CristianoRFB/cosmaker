'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/providers/auth-provider';
import { authenticatedFileRequest } from '@/repositories/order-files.repository';
import type { ProductionPhoto } from '@/types/production';

export function ProductionPhotoImage({ photo, alt, className, width, height }: {
  photo: ProductionPhoto; alt: string; className: string; width: number; height: number;
}) {
  const { firebaseUser, user } = useAuth();
  const uid = user?.active === true ? firebaseUser?.uid : undefined;
  const key = JSON.stringify([uid, photo.atelierId, photo.orderId, photo.id, photo.storageGeneration, photo.uploadStatus, photo.visibleToClient]);
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!uid || photo.uploadStatus !== 'ready') return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    let active = true;
    void authenticatedFileRequest('downloadProductionPhotoBytes', photo.atelierId, photo.orderId, photo.id, { signal: controller.signal }, 'photoId')
      .then((response) => response.blob())
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ key, url: objectUrl });
      })
      .catch(() => { if (active) setFailedKey(key); });
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [key, uid, photo.atelierId, photo.orderId, photo.id, photo.uploadStatus]);
  if (image?.key === key && uid) return <Image alt={alt} className={className} height={height} src={image.url} unoptimized width={width} />;
  return <div aria-label="Imagem indisponível" className={`${className} grid place-items-center text-xs text-slate-500`} role="status">{failedKey === key || !uid || photo.uploadStatus !== 'ready' ? 'Imagem não disponível' : 'Carregando imagem…'}</div>;
}
