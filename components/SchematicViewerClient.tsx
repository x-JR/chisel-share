'use client';

import dynamic from 'next/dynamic';

const SchematicViewerClient = dynamic(() => import('./SchematicViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg">
      <div className="text-slate-400 text-sm">Loading viewer…</div>
    </div>
  ),
});

export default SchematicViewerClient;
