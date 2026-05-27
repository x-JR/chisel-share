import HowToTabs from '@/components/HowToTabs';

export default function HowToPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-100">How To</h1>
        <p className="text-slate-400 mt-1">
          Guides for saving, importing, and sharing chisel schematics in Vintage Story.
        </p>
      </div>
      <HowToTabs />
    </main>
  );
}
