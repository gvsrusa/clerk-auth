import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-[var(--background)] text-[var(--foreground)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center">
        <div className="text-4xl font-bold">Chess Game</div>
        
        <div className="flex flex-col gap-8 items-center">
          <div className="flex gap-4 items-center flex-col">
            <Link
              href="/single-player"
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] gap-2 hover:bg-[var(--btn-primary-hover)] font-medium text-base h-12 px-6 w-64 text-center"
            >
              Play Against Computer
            </Link>
            
            <Link
              href="/multiplayer"
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-[var(--btn-success-bg)] text-[var(--btn-success-text)] gap-2 hover:bg-[var(--btn-success-hover)] font-medium text-base h-12 px-6 w-64 text-center"
            >
              Play Multiplayer
            </Link>
          </div>
          
          <div className="mt-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Game Features</h2>
            <ul className="list-disc text-left space-y-2 pl-5">
              <li>Single-player mode with adjustable AI difficulty</li>
              <li>Multiplayer mode for playing against friends</li>
              <li>Save and resume games</li>
              <li>Optional hints and position analysis</li>
              <li>Undo/redo moves</li>
            </ul>
          </div>
        </div>
      </main>
      
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <div className="text-sm text-[var(--status-info)]">
          Chess Game &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
