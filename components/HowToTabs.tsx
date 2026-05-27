'use client';

import { useState } from 'react';
import Link from 'next/link';

type Tab = 'qpchisel' | 'chizwiz';

// ─── Shared primitives ────────────────────────────────────────────────────────

function StepList({ steps }: { steps: { step: string; title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="space-y-4">
      {steps.map(({ step, title, body }) => (
        <li key={step} className="flex gap-4">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-600/20 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center justify-center">
            {step}
          </span>
          <div>
            <p className="text-slate-200 font-medium text-sm">{title}</p>
            <div className="text-slate-400 text-sm mt-0.5">{body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-slate-700 border border-slate-600 text-slate-200 text-xs font-mono px-1.5 py-0.5 rounded">
      {children}
    </kbd>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-amber-300">{children}</code>
  );
}

function PathBlock({ children }: { children: React.ReactNode }) {
  return (
    <code className="block mt-2 bg-slate-800 px-3 py-2 rounded-lg text-xs text-amber-300 break-all">
      {children}
    </code>
  );
}

function Divider() {
  return <div className="border-t border-slate-800 my-10" />;
}

function CopyablePath({ os, path, osWidth = 'w-16' }: { os: string; path: string; osWidth?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(path).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy"
      className="w-full bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-left transition-colors group"
    >
      <span className={`text-slate-400 text-sm ${osWidth} flex-shrink-0`}>{os}</span>
      <code className="text-amber-300 text-xs break-all flex-1">{path}</code>
      <span className={`text-xs flex-shrink-0 transition-colors ${
        copied ? 'text-green-400' : 'text-slate-600 group-hover:text-slate-400'
      }`}>
        {copied ? '✓ Copied' : 'Copy'}
      </span>
    </button>
  );
}

// ─── QP Chisel tab ────────────────────────────────────────────────────────────

function QPChiselContent() {
  return (
    <>
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-amber-400 mb-4">Exporting a schematic</h2>
        <p className="text-slate-400 text-sm mb-5">
          Use these steps to save one of your in-game chisel creations and upload it to Chisel Share.
        </p>
        <StepList
          steps={[
            {
              step: '1',
              title: 'Craft or obtain a QP Chisel Pantograph',
              body: (
                <>
                  The Pantograph item is required to save and load chisel block shapes. See the{' '}
                  <a
                    href="https://mods.vintagestory.at/chiseltools"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    ChiselTools mod page
                  </a>{' '}
                  for crafting recipes if you haven&apos;t already made one.
                </>
              ),
            },
            {
              step: '2',
              title: 'Place your chiselled block',
              body: 'Place the chiselled block containing your creation on the ground in-game.',
            },
            {
              step: '3',
              title: 'Left-click the block with the Pantograph',
              body: 'Hold the Pantograph in your hand, look at the chiselled block, and left-click it.',
            },
            {
              step: '4',
              title: "Press 'P' to open the shape menu",
              body: (
                <>
                  While looking at the block, press <Kbd>P</Kbd> on your keyboard to open the save
                  / load shape menu.
                </>
              ),
            },
            {
              step: '5',
              title: 'Select "Save Shape"',
              body: (
                <>
                  Choose <strong className="text-slate-200">Save Shape</strong> from the menu. The
                  schematic file will be saved to your ChiselTools data folder as an{' '}
                  <InlineCode>.xml</InlineCode> file.
                </>
              ),
            },
            {
              step: '6',
              title: 'Locate the saved file',
              body: (
                <>
                  Open your game data folder and navigate to:
                  <PathBlock>VintagestoryData/ModData/ChiselTools/</PathBlock>
                  <span className="text-slate-500 text-xs mt-1 block">
                    On Windows this is typically inside{' '}
                    <InlineCode>%APPDATA%\VintagestoryData\</InlineCode>, and on Linux under{' '}
                    <InlineCode>~/.config/VintagestoryData/</InlineCode>.
                  </span>
                </>
              ),
            },
            {
              step: '7',
              title: 'Upload to Chisel Share',
              body: (
                <>
                  Copy the <InlineCode>.xml</InlineCode> file to your computer and head to the{' '}
                  <Link
                    href="/upload"
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    Upload page
                  </Link>{' '}
                  to submit it.
                </>
              ),
            },
          ]}
        />
      </section>

      <Divider />

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-amber-400 mb-4">Importing a schematic</h2>
        <p className="text-slate-400 text-sm mb-5">
          Use these steps to load a schematic you downloaded from Chisel Share into your game.
        </p>
        <StepList
          steps={[
            {
              step: '1',
              title: 'Download the schematic file',
              body: (
                <>
                  From any schematic page on Chisel Share, click{' '}
                  <strong className="text-slate-200">Download</strong> to save the{' '}
                  <InlineCode>.xml</InlineCode> file to your computer.
                </>
              ),
            },
            {
              step: '2',
              title: 'Copy it to your ChiselTools folder',
              body: (
                <>
                  Move or copy the file into:
                  <PathBlock>VintagestoryData/ModData/ChiselTools/</PathBlock>
                  <span className="text-slate-500 text-xs mt-1 block">
                    This is the same folder your own exports appear in. Create the folder if it
                    doesn&apos;t exist yet.
                  </span>
                </>
              ),
            },
            {
              step: '3',
              title: 'Place a chisel block in-game',
              body: 'Place an empty chisel block on the ground where you want to stamp the schematic.',
            },
            {
              step: '4',
              title: 'Open the shape menu on the empty block',
              body: (
                <>
                  Hold the Pantograph in your hand, press <Kbd>P</Kbd> while looking at the empty
                  chiselled block, then select the imported shape from the menu.
                </>
              ),
            },
          ]}
        />
      </section>

      <Divider />

      <section>
        <h2 className="text-xl font-semibold text-amber-400 mb-4">Schematic folder locations</h2>
        <div className="space-y-3">
          {[
            { os: 'Windows', path: '%APPDATA%\\VintagestoryData\\ModData\\ChiselTools\\' },
            { os: 'Linux', path: '~/.config/VintagestoryData/ModData/ChiselTools/' },
            { os: 'macOS', path: '~/Library/Application Support/VintagestoryData/ModData/ChiselTools/' },
          ].map(({ os, path }) => (
            <CopyablePath key={os} os={os} path={path} />
          ))}
        </div>
      </section>
    </>
  );
}

// ─── ChizWiz tab ──────────────────────────────────────────────────────────────

function ChizWizContent() {
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <>
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-amber-400 mb-4">Saving a design to your catalogue</h2>
        <p className="text-slate-400 text-sm mb-5">
          Chisel Wiz stores all your designs in a single{' '}
          <InlineCode>chiselwiz-catalogue.json</InlineCode> file. Follow these steps to save an
          in-game design and then share it on Chisel Share.
        </p>
        <StepList
          steps={[
            {
              step: '1',
              title: 'Install Chisel Wiz',
              body: (
                <>
                  Download and install the{' '}
                  <a
                    href="https://mods.vintagestory.at/chiselwiz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    Chisel Wiz mod
                  </a>{' '}
                  from the Vintage Story mod database if you haven&apos;t already.
                </>
              ),
            },
            {
              step: '2',
              title: 'Hold a chisel and hammer',
              body: (
                <>
                  Equip a <strong className="text-slate-200">chisel</strong> in your active item
                  slot and a <strong className="text-slate-200">hammer</strong> in your offhand.
                </>
              ),
            },
            {
              step: '3',
              title: 'Copy the design to your clipboard',
              body: (
                <>
                  Look at the chiselled block you want to save, then press{' '}
                  <Kbd>Ctrl+Shift+C</Kbd> to copy its design to your clipboard.
                </>
              ),
            },
            {
              step: '4',
              title: 'Open the expanded clipboard window',
              body: (
                <>
                  Open your <strong className="text-slate-200">inventory</strong> to expand the
                  clipboard panel.
                </>
              ),
            },
            {
              step: '5',
              title: 'Press "Save Design"',
              body: (
                <>
                  In the expanded clipboard window, click{' '}
                  <strong className="text-slate-200">Save Design</strong>. The design is now saved
                  to your <InlineCode>chiselwiz-catalogue.json</InlineCode>.
                </>
              ),
            },
            {
              step: '6',
              title: 'Locate the catalogue file',
              body: (
                <>
                  Your catalogue lives in the <InlineCode>ModConfig</InlineCode> folder inside your
                  Vintage Story data directory (see folder locations below).
                </>
              ),
            },
            {
              step: '7',
              title: 'Upload to Chisel Share',
              body: (
                <>
                  Head to the{' '}
                  <Link
                    href="/upload"
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    Upload page
                  </Link>{' '}
                  and drop your <InlineCode>.json</InlineCode> catalogue — Chisel Share will
                  import every design inside it automatically.
                </>
              ),
            },
          ]}
        />
      </section>

      <Divider />

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-amber-400 mb-4">Importing designs from Chisel Share</h2>
        <p className="text-slate-400 text-sm mb-5">
          Chisel Wiz uses a single catalogue file, so adding new designs means merging them in. The
          easiest way is to use the Chisel Share Catalogue Tool — no manual JSON editing required.
        </p>
        <StepList
          steps={[
            {
              step: '1',
              title: 'Open the Catalogue Tool',
              body: (
                <>
                  Go to{' '}
                  <Link
                    href="/upload/chiselwiz"
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    Catalogue Tool
                  </Link>{' '}
                  on Chisel Share.
                </>
              ),
            },
            {
              step: '2',
              title: 'Upload your existing catalogue',
              body: (
                <>
                  Drop your current <InlineCode>chiselwiz-catalogue.json</InlineCode> into the
                  drop zone. Your existing designs will be listed. The file is read entirely in your
                  browser — nothing is uploaded to the server at this step.
                </>
              ),
            },
            {
              step: '3',
              title: 'Add designs from the gallery',
              body: (
                <>
                  Use the <strong className="text-slate-200">Add designs from gallery</strong>{' '}
                  search box to find schematics on Chisel Share and add them to your catalogue with
                  one click.
                </>
              ),
            },
            {
              step: '4',
              title: 'Download the merged catalogue',
              body: (
                <>
                  Click <strong className="text-slate-200">Download catalogue</strong> to save the
                  merged <InlineCode>.json</InlineCode> file.
                </>
              ),
            },
            {
              step: '5',
              title: 'Replace your existing catalogue file',
              body: (
                <>
                  Copy the downloaded file to your <InlineCode>ModConfig</InlineCode> folder,
                  replacing the old <InlineCode>chiselwiz-catalogue.json</InlineCode>.
                </>
              ),
            },
            {
              step: '6',
              title: 'Load the design in-game',
              body: (
                <>
                  In-game, press <Kbd>F</Kbd> while holding a chisel to open the tool mode window,
                  then click the <strong className="text-slate-200">catalogue icon</strong> at the
                  top right. Your new designs will appear in the list ready to paste.
                </>
              ),
            },
          ]}
        />

        <div className="mt-6 border border-slate-700 rounded-lg overflow-hidden text-sm">
          {/* Header / toggle */}
          <button
            type="button"
            onClick={() => setManualOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-3 bg-slate-800 hover:bg-slate-700 transition-colors px-4 py-3 text-left"
          >
            <span className="text-slate-400">
              <strong className="text-slate-300">Prefer manual editing?</strong> You can also add
              a design directly into the JSON file — click to see how.
            </span>
            <span className="text-slate-400 flex-shrink-0 text-xs">{manualOpen ? '▲ Hide' : '▼ Show'}</span>
          </button>

          {/* Expanded guide */}
          {manualOpen && (
            <div className="bg-slate-900 border-t border-slate-700 px-4 py-5 space-y-5 text-slate-400">
              <p>
                A Chisel Wiz catalogue is a plain text file. You can open it in any text editor
                (Notepad on Windows, TextEdit on Mac, or VS Code). It looks like this:
              </p>

              {/* Catalogue structure diagram */}
              <pre className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-xs text-amber-300 overflow-x-auto leading-relaxed">{`{
  "version": 1,
  "designs": [
    { "name": "My First Design", "blueprintData": { ... } },
    { "name": "My Second Design", "blueprintData": { ... } }
  ]
}`}</pre>

              <p>
                When you download a single design from Chisel Share, it arrives as a{' '}
                <InlineCode>.json</InlineCode> file with the same structure — one item inside
                the <InlineCode>designs</InlineCode> array.
              </p>

              <p className="text-slate-300 font-medium">Steps to add it manually:</p>
              <ol className="space-y-3 list-none">
                {[
                  'Open your chiselwiz-catalogue.json in a text editor.',
                  'Open the downloaded .json file in another window or tab.',
                  <>Find the single design object in the downloaded file — it starts with <InlineCode>{'{'}</InlineCode> and ends with <InlineCode>{'}'}</InlineCode> inside the <InlineCode>designs</InlineCode> array. Select and copy the whole thing.</>,
                  <>In your catalogue, scroll to the end of the <InlineCode>designs</InlineCode> array. Find the last <InlineCode>{'}'}</InlineCode> before the closing <InlineCode>{']'}</InlineCode>.</>,
                  <>Add a comma <InlineCode>,</InlineCode> after that last <InlineCode>{'}'}</InlineCode>, then on the next line paste the design you copied.</>,
                  'Save the file.',
                ].map((text, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-600/20 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm">{text}</span>
                  </li>
                ))}
              </ol>

              {/* Before / After */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Before</p>
                  <pre className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto leading-relaxed">{`"designs": [
  { "name": "My Pillar" }
]`}</pre>
                </div>
                <div>
                  <p className="text-xs font-medium text-green-600 mb-1.5 uppercase tracking-wide">After</p>
                  <pre className="bg-slate-800 border border-green-800 rounded-lg p-3 text-xs leading-relaxed overflow-x-auto">
                    <span className="text-slate-300">{`"designs": [
  { "name": "My Pillar" },
  `}</span><span className="text-green-400">{`{ "name": "New Design" }`}</span><span className="text-slate-300">{`
]`}</span>
                  </pre>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                <strong className="text-slate-400">Common mistake:</strong> forgetting the comma{' '}
                <InlineCode>,</InlineCode> between the last existing design and the new one. If
                the game doesn&apos;t load your catalogue, check that every design except the last
                one ends with a comma.
              </p>
            </div>
          )}
        </div>
      </section>

      <Divider />

      <section>
        <h2 className="text-xl font-semibold text-amber-400 mb-4">Catalogue file location</h2>
        <div className="space-y-3">
          {[
            {
              os: 'Windows',
              path: '%APPDATA%\\VintagestoryData\\ModConfig\\chiselwiz-catalogue.json',
            },
            {
              os: 'Linux',
              path: '~/.config/VintagestoryData/ModConfig/chiselwiz-catalogue.json',
            },
            {
              os: 'Linux (Flatpak)',
              path: '~/.var/app/at.vintagestory.VintageStory/config/VintagestoryData/ModConfig/chiselwiz-catalogue.json',
            },
            {
              os: 'macOS',
              path: '~/Library/Application Support/VintagestoryData/ModConfig/chiselwiz-catalogue.json',
            },
          ].map(({ os, path }) => (
            <CopyablePath key={os} os={os} path={path} osWidth="w-28" />
          ))}
        </div>
      </section>
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function HowToTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('qpchisel');

  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: 'qpchisel', label: 'QP Chisel', href: 'https://mods.vintagestory.at/chiseltools' },
    { id: 'chizwiz', label: 'Chisel Wiz', href: 'https://mods.vintagestory.at/chiselwiz' },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mod link */}
      <p className="text-slate-500 text-sm mb-8">
        {activeTab === 'qpchisel' ? (
          <>
            Instructions for{' '}
            <a
              href="https://mods.vintagestory.at/chiseltools"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
            >
              QP Chisel (ChiselTools)
            </a>
            {' '}— a Vintage Story mod for creating and saving chisel block designs.
          </>
        ) : (
          <>
            Instructions for{' '}
            <a
              href="https://mods.vintagestory.at/chiselwiz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
            >
              Chisel Wiz
            </a>
            {' '}— an alternative chisel mod that stores all your designs in a single catalogue file.
          </>
        )}
      </p>

      {/* Tab content */}
      {activeTab === 'qpchisel' ? <QPChiselContent /> : <ChizWizContent />}
    </>
  );
}
