'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  id: string;
  alt: string;
}

/**
 * Renders a schematic thumbnail image with graceful fallback:
 * hides itself (returns null) if the thumbnail is not yet generated,
 * and fades in smoothly once loaded to avoid an abrupt pop-in.
 */
export default function ThumbnailImage({ id, alt }: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // The <img> may finish loading (e.g. from cache, or before hydration attaches
  // the onLoad listener) prior to this effect running, so check .complete too.
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={`/api/schematics/${id}/thumb`}
      alt={alt}
      loading="lazy"
      className={`h-full w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}
