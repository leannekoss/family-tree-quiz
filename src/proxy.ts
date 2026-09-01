import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next 16 : middleware.ts s'appelle proxy.ts. Rôle unique ici, rafraîchir la
// session Supabase et rediriger vers /rejoindre. L'autorisation réelle, c'est RLS.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // « Où sont mes données » reste lisible sans compte, et c'est le point : on
  // veut savoir où va sa photo avant de la déposer, pas après. Une page qui
  // rassure derrière une porte fermée ne rassure personne.
  const publique = ["/rejoindre", "/donnees"].some((c) =>
    request.nextUrl.pathname.startsWith(c),
  );

  if (!user && !publique) {
    const url = request.nextUrl.clone();
    url.pathname = "/rejoindre";
    // 🔑 Où l'on allait, gardé pour y revenir après la connexion. Sans cela, un
    // lien de fiche envoyé à quelqu'un qui n'est pas encore entré était perdu :
    // il saisissait le code famille et atterrissait sur l'accueil, sans jamais
    // savoir pourquoi on lui avait envoyé ce lien. C'est la dernière marche de
    // tout partage, et elle manquait.
    //
    // Le chemin ET la requête, parce que `/?q=Chastel` et `/lieux?maison=3` sont
    // des destinations à part entière. Jamais l'hôte : une valeur venue de
    // l'extérieur ne doit pas pouvoir emmener quelqu'un hors du site.
    const allait = request.nextUrl.pathname + request.nextUrl.search;
    // On repart d'une adresse propre : `clone()` garde la requête d'origine, et
    // « /lieux?maison=3 » donnait « /rejoindre?maison=3&puis=… ». Au-delà du
    // bruit, `/personne/x?code=nimporte` aurait pré-rempli le champ du code
    // famille depuis un lien fabriqué par n'importe qui.
    url.search = "";
    if (allait !== "/") url.searchParams.set("puis", allait);
    const redirect = NextResponse.redirect(url);
    // Sans ce report, une redirection jette les cookies que le rafraîchissement
    // vient d'écrire : la session repart à zéro à chaque expiration du jeton,
    // et l'utilisateur se retrouve dehors sans raison visible.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  // robots.txt doit rester lisible sans session : un crawler qui reçoit une
  // redirection à sa place ne voit jamais l'interdiction d'indexer.
  matcher: [
    // Les icônes doivent sortir sans session, sinon l'onglet reste vide pour
    // qui n'est pas encore entré — c'est-à-dire précisément sur la page de
    // connexion, le premier écran que voit la famille. Le navigateur reçoit
    // une redirection là où il attend une image, et n'affiche rien.
    // Elles ne portent aucune donnée : c'est un dessin.
    //
    // `opengraph-image` pour la même raison, et c'est celle qui décide de
    // l'accueil réservé au lien : le robot de WhatsApp n'a évidemment pas de
    // session, il recevait donc une redirection là où il attendait un PNG — et
    // le lien s'affichait dans le groupe comme une ligne grise sans vignette,
    // c'est-à-dire comme un lien douteux. La vignette ne porte que le nom de
    // la famille et ce que contient le site ; rien qui ne soit déjà dans le
    // message qui l'accompagne.
    "/((?!_next/static|_next/image|robots.txt|favicon.ico|icon.svg|icon.png|apple-icon.png|opengraph-image).*)",
  ],
};
