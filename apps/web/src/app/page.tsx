import { DEFAULT_CURRENCY } from '@crossval/shared';

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Settlements</h1>
      <p className="text-sm text-zinc-500">Base currency {DEFAULT_CURRENCY}</p>
    </main>
  );
}
