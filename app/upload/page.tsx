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

      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-slate-300 font-semibold mb-3">How to export your schematic</h2>
        <ol className="text-slate-400 text-sm space-y-2 list-decimal list-inside">
          <li>In Vintage Story, place your chisel block on the ground</li>
          <li>Right-click the block with the QP Chisel Pantograph item</li>
          <li>Select &ldquo;Export&rdquo; to save as an .xml file</li>
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
