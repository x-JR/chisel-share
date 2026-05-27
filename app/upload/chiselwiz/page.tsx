import ChiselWizMergeTool from '@/components/ChiselWizMergeTool';

export default function ChiselWizMergePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">Chisel Wiz Catalogue Tool</h1>
        <p className="text-slate-400 mt-1">
          Upload your existing Chisel Wiz catalogue, add designs from the gallery, download a merged
          catalogue, or share your designs with the community.
        </p>
      </div>
      <ChiselWizMergeTool />
    </main>
  );
}
