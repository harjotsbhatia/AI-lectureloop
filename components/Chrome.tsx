import Link from "next/link";
import type { ReactNode } from "react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-accent text-sm text-accent-fg"
      >
        ↻
      </span>
      LectureLoop
    </Link>
  );
}

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Logo />
        {children}
      </div>
    </header>
  );
}

/** Full-page placeholder: loading, or "not found" with a way home. */
export function PageMessage({ children, home }: { children: ReactNode; home?: boolean }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto grid w-full max-w-7xl flex-1 place-items-center px-4 py-24 text-center">
        <div>
          <p className="text-muted">{children}</p>
          {home && (
            <Link href="/" className="btn mt-4">
              Back to your courses
            </Link>
          )}
        </div>
      </main>
    </>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
      {children}
    </p>
  );
}
