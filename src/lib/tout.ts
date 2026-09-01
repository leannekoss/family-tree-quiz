/**
 * Charger une table ENTIÈRE, par tranches.
 *
 * 🔑 PostgREST ne renvoie jamais plus de mille lignes par requête, et il ne le
 * dit pas : la réponse est un 200 avec un tableau parfaitement valide, juste
 * amputé. Sur l'arbre, cela donnait un dessin construit sur un tiers de la
 * famille — des branches entières absentes, sans le moindre message. Le bug
 * s'est d'abord vu sur les photos (« je ne peux pas lier cette photo à Auguste
 * Velay », 20/08) : là-bas, la réponse était de ne plus tout charger du tout et
 * de chercher en base. Ici c'est impossible — on ne peut pas dessiner un arbre
 * sans le graphe entier — donc on pagine.
 *
 * On échoue fort si une tranche échoue : un arbre silencieusement incomplet est
 * pire qu'une page en erreur, parce que personne ne peut le remarquer.
 */
const TRANCHE = 1000;
/** Garde-fou : 50 tranches = 50 000 lignes, très au-delà de la famille. */
const TRANCHES_MAX = 50;

export async function toutCharger<T>(
  tranche: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tout: T[] = [];
  for (let n = 0; n < TRANCHES_MAX; n++) {
    const de = n * TRANCHE;
    const { data, error } = await tranche(de, de + TRANCHE - 1);
    if (error) throw new Error(`chargement interrompu à la ligne ${de} : ${error.message}`);
    if (!data || data.length === 0) return tout;
    tout.push(...data);
    if (data.length < TRANCHE) return tout;
  }
  throw new Error(`plus de ${TRANCHES_MAX * TRANCHE} lignes : chargement interrompu`);
}
