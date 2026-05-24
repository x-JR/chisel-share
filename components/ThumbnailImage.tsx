'use client';

import { useState } from 'react';

interface Props {
  id: string;
  alt: string;
}

/**
 * Renders a schematic thumbnail image with graceful fallback:
 * hides itself (returns null) if the thumbnail is not yet generated.
 */
export default function ThumbnailImage({ id, alt }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/schematics/${id}/thumb`}
      alt={alt}
      className="w-full h-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}
