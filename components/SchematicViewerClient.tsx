'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const SchematicViewerInner = dynamic(() => import('./SchematicViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg">
      <div className="text-slate-400 text-sm">Loading viewer…</div>
    </div>
  ),
});

interface Props {
  xmlContent: string;
  className?: string;
  schematicId?: string;
  canRotate?: boolean;
}

export default function SchematicViewerClient({
  xmlContent: initialXml,
  className,
  schematicId,
  canRotate,
}: Props) {
  const [xmlContent, setXmlContent] = useState(initialXml);

  return (
    <SchematicViewerInner
      xmlContent={xmlContent}
      className={className}
      schematicId={schematicId}
      canRotate={canRotate}
      onXmlUpdate={setXmlContent}
    />
  );
}
