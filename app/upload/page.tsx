import Link from 'next/link';
import UploadForm from '@/components/UploadForm';

export default function UploadPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Upload Schematic</h1>
        <p className="text-slate-400 mt-1">Share your QP Chisel creation with the community</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <UploadForm />
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2 text-center justify-center text-sm text-slate-500">
        <p>
          Uploading multiple related pieces?{' '}
          <Link href="/upload/collection" className="text-amber-500 hover:text-amber-400 transition-colors">
            Upload as a collection →
          </Link>
        </p>
        <span className="hidden sm:inline text-slate-700">|</span>
        <p>
          Have a Chisel Wiz catalogue?{' '}
          <Link href="/upload/chiselwiz" className="text-amber-500 hover:text-amber-400 transition-colors">
            Merge or share your catalogue →
          </Link>
        </p>
      </div>

      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-slate-300 font-semibold mb-3">How to export your schematic</h2>
        <ol className="text-slate-400 text-sm space-y-2 list-decimal list-inside">
          <li>In Vintage Story, place your chiselled block on the ground</li>
          <li>Left-click the block with the QP Chisel Pantograph in hand</li>
          <li>Press <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-amber-300">P</code> to open the save / load shape menu</li>
          <li>Select &ldquo;Save Shape&rdquo; to save the schematic as an .xml file</li>
          <li>
            Find the file in{' '}
            <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-amber-300">
              VintagestoryData/ModData/ChiselTools/
            </code>
          </li>
        </ol>
      </div>
    </main>
  );
}
