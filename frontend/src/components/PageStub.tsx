export function PageStub({ title, phase }: { title: string; phase: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[1200px] items-center justify-center px-4">
      <div className="w-full max-w-md rounded bg-white p-8 text-center shadow-card">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-ink-secondary">A ser implementado na {phase}.</p>
      </div>
    </main>
  )
}
