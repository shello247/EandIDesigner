"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="standards-workspace"><h1>Standards &amp; Assurance could not be loaded</h1><p>Your existing records have not been changed.</p><button className="standards-button" onClick={reset}>Retry</button></main>; }

