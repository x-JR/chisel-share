export default function HowToPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-100">How To</h1>
        <p className="text-slate-400 mt-1">
          A guide to saving and importing{' '}
          <a
            href="https://mods.vintagestory.at/chiseltools"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            QP Chisel
          </a>{' '}
          schematics in Vintage Story.
        </p>
      </div>

      {/* Export section */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-amber-400 mb-4">Exporting a schematic</h2>
        <p className="text-slate-400 text-sm mb-5">
          Use these steps to save one of your in-game chisel creations and upload it to Chisel Share.
        </p>
        <ol className="space-y-4">
          {[
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
              title: 'Press \'P\' to open the shape menu',
              body: (
                <>
                  While looking at the block, press{' '}
                  <kbd className="bg-slate-700 border border-slate-600 text-slate-200 text-xs font-mono px-1.5 py-0.5 rounded">
                    P
                  </kbd>{' '}
                  on your keyboard to open the save / load shape menu.
                </>
              ),
            },
            {
              step: '5',
              title: 'Select "Save Shape"',
              body: (
                <>
                  Choose <strong className="text-slate-200">Save Shape</strong> from the menu. The schematic file will
                  be saved to your ChiselTools data folder as an{' '}
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-amber-300">.xml</code> file.
                </>
              ),
            },
            {
              step: '6',
              title: 'Locate the saved file',
              body: (
                <>
                  Open your game data folder and navigate to:{' '}
                  <code className="block mt-2 bg-slate-800 px-3 py-2 rounded-lg text-xs text-amber-300 break-all">
                    VintagestoryData/ModData/ChiselTools/
                  </code>
                  <span className="text-slate-500 text-xs mt-1 block">
                    On Windows this is typically inside{' '}
                    <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">%APPDATA%\VintagestoryData\</code>
                    , and on Linux under{' '}
                    <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">~/.config/VintagestoryData/</code>.
                  </span>
                </>
              ),
            },
            {
              step: '7',
              title: 'Upload to Chisel Share',
              body: (
                <>
                  Copy the{' '}
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-amber-300">.xml</code> file to your
                  computer and head to the{' '}
                  <a href="/upload" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                    Upload page
                  </a>{' '}
                  to submit it.
                </>
              ),
            },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-600/20 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center justify-center">
                {step}
              </span>
              <div>
                <p className="text-slate-200 font-medium text-sm">{title}</p>
                <p className="text-slate-400 text-sm mt-0.5">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="border-t border-slate-800 mb-10" />

      {/* Import section */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-amber-400 mb-4">Importing a schematic</h2>
        <p className="text-slate-400 text-sm mb-5">
          Use these steps to load a schematic you downloaded from Chisel Share into your game.
        </p>
        <ol className="space-y-4">
          {[
            {
              step: '1',
              title: 'Download the schematic file',
              body: (
                <>
                  From any schematic page on Chisel Share, click <strong className="text-slate-200">Download</strong> to
                  save the{' '}
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-amber-300">.xml</code> file to your
                  computer.
                </>
              ),
            },
            {
              step: '2',
              title: 'Copy it to your ChiselTools folder',
              body: (
                <>
                  Move or copy the file into:{' '}
                  <code className="block mt-2 bg-slate-800 px-3 py-2 rounded-lg text-xs text-amber-300 break-all">
                    VintagestoryData/ModData/ChiselTools/
                  </code>
                  <span className="text-slate-500 text-xs mt-1 block">
                    This is the same folder your own exports appear in. Create the folder if it doesn&apos;t exist yet.
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
              title: 'Open the Portfolio menu while looking at the block',
              body: 'Hold the Pantograph in your hand and press \'P\' on the empty chiselled block, then select the imported block from the shape menu.',
            },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-600/20 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center justify-center">
                {step}
              </span>
              <div>
                <p className="text-slate-200 font-medium text-sm">{title}</p>
                <p className="text-slate-400 text-sm mt-0.5">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="border-t border-slate-800 mb-10" />

      {/* Folder reference */}
      <section>
        <h2 className="text-xl font-semibold text-amber-400 mb-4">Schematic folder locations</h2>
        <div className="space-y-3">
          {[
            { os: 'Windows', path: '%APPDATA%\\VintagestoryData\\ModData\\ChiselTools\\' },
            { os: 'Linux', path: '~/.config/VintagestoryData/ModData/ChiselTools/' },
            { os: 'macOS', path: '~/Library/Application Support/VintagestoryData/ModData/ChiselTools/' },
          ].map(({ os, path }) => (
            <div key={os} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-slate-400 text-sm w-16 flex-shrink-0">{os}</span>
              <code className="text-amber-300 text-xs break-all">{path}</code>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
