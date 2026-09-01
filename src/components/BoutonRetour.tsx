"use client";

import { useRouter } from "next/navigation";

export default function BoutonRetour() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
    >
      <span aria-hidden>←</span>
      Revenir
    </button>
  );
}
