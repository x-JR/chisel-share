import type { Metadata } from 'next';
import './globals.css';
import TokenManager from '@/components/TokenManager';

export const metadata: Metadata = {
  title: 'Chisel Share',
  description: 'Browse and share QP Chisel schematics for Vintage Story',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            {/* Left: logo + nav links */}
            <div className="flex items-center gap-6">
              <a
                href="/"
                className="text-amber-400 font-bold text-lg hover:text-amber-300 transition-colors"
              >
                Chisel Share
              </a>
              <a
                href="/how-to"
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                How To
              </a>
            </div>
            {/* Right: actions */}
            <div className="flex items-center gap-3">
              <a
                href="/upload"
                className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                + Upload
              </a>
              <a
                href="/upload/collection"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors"
              >
                + Collection
              </a>
              <TokenManager />
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
