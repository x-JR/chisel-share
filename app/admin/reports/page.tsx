import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { getReportedCollections } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Collection Reports — Admin',
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function AdminReportsPage() {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) notFound();

  const cookieStore = await cookies();
  const uploaderToken = cookieStore.get('uploader_token')?.value;
  if (uploaderToken !== adminToken) notFound();

  const reported = await getReportedCollections();

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Back to gallery
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-amber-400 mb-6">
        Reported Collections
      </h1>

      {reported.length === 0 ? (
        <p className="text-slate-500 text-center py-16">No reports yet.</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Collection</th>
                <th className="px-4 py-3 font-medium text-center">Reports</th>
                <th className="px-4 py-3 font-medium">Last Reported</th>
              </tr>
            </thead>
            <tbody>
              {reported.map((r) => (
                <tr key={r.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/view/collection/${r.id}`}
                      className="text-amber-400 hover:text-amber-300 transition-colors font-medium"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-red-900/40 text-red-300 border border-red-700/60 text-xs font-bold px-2 py-0.5 rounded-full">
                      {r.report_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDate(r.last_reported_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
