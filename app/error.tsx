'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="p-6"><h1>Ocorreu um erro</h1><button onClick={reset}>Tentar novamente</button></main>; }
