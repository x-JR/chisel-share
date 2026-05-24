import Link from 'next/link';
import UploadCollectionForm from '@/components/UploadCollectionForm';

export default function UploadCollectionPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <Link
          href="/upload"
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Back to single upload
        </Link>
        <h1 className="text-3xl font-bold text-slate-100 mt-4">Upload Collection</h1>
        <p className="text-slate-400 mt-1">
          Group multiple schematics that form a single design — for example the top, middle, and
          bottom pieces of a pillar
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <UploadCollectionForm />
      </div>

      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-slate-300 font-semibold mb-3">Tips for collections</h2>
        <ul className="text-slate-400 text-sm space-y-2 list-disc list-inside">
          <li>Add files in the order you want them displayed (top → middle → bottom)</li>
          <li>Give each part a clear name so visitors know which piece is which</li>
          <li>You can drag parts up and down to reorder them after adding</li>
          <li>Each part can still be downloaded individually from the collection view</li>
        </ul>
      </div>
    </main>
  );
}
