import Link from "next/link";

// Sans cette page, Next sert son écran par défaut, en anglais et hors charte —
// y compris à un membre qui tombe sur une page réservée aux gardiens.
export default function Introuvable() {
  return (
    <div className="py-12 text-center">
      <h1 className="serif text-2xl font-semibold">Cette page n&apos;existe pas</h1>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        Le lien est peut-être ancien, ou la fiche a été supprimée depuis.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-accent px-5 py-3 font-medium text-sur-plein"
      >
        Chercher quelqu&apos;un
      </Link>
    </div>
  );
}
