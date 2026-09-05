#!/usr/bin/env python3
"""Étape 4 : récupérer les photos Wikidata/Commons et les déposer dans le bucket Supabase.

Lit data/windsor/personnes.jsonl pour les QID ayant un champ `image`.
Pour chaque image :
  1. Commons API → vignette 1000 px + métadonnées (licence, auteur, crédit)
  2. Pillow → redimensionner à 1000 px (plein) + 240 px (vignette)
  3. Upload via Supabase Storage REST (service_role key)
  4. UPDATE people SET photo_url = chemin

Reprise : si data/windsor/photos.jsonl contient déjà le QID, on saute.
Lots de 25 avec persistance entre chaque lot.

Usage : python3 4_photos.py [--ecrire] [--limite N]
  Sans --ecrire : dry-run (télécharge mais n'uploade pas)
  --limite N : ne traiter que les N premières fiches (pour tester)

Variables d'env requises :
  SUPABASE_URL       URL du projet Supabase démo
  SUPABASE_SERVICE_KEY   clé service_role (JAMAIS la clé anon)
"""

import json, os, sys, time, io, hashlib, re, html
from pathlib import Path
from urllib.parse import quote

try:
    import requests
    from PIL import Image
except ImportError:
    print("pip install requests Pillow", file=sys.stderr)
    sys.exit(1)

RACINE = Path(__file__).resolve().parents[2]
DATA = RACINE / "data" / "windsor"
PERSONNES = DATA / "personnes.jsonl"
JOURNAL = DATA / "photos.jsonl"
CREDITS = RACINE / "public" / "credits-photos.json"

ENTETES_COMMONS = {"User-Agent": "family-tree-demo/0.1 (contact@example.com)"}
MAX_COTE = 1000
VIGNETTE_COTE = 240
LOT = 25


def texte_brut(fragment: str) -> str:
    """L'« Artist » de Commons est du HTML (liens, <bdi>) : on n'en garde que le texte."""
    return html.unescape(re.sub(r"<[^>]+>", "", fragment or "")).strip()

def charger_journal() -> dict:
    """QID → entrée du journal (déjà traité)."""
    if not JOURNAL.exists():
        return {}
    res = {}
    for line in JOURNAL.read_text().splitlines():
        if line.strip():
            e = json.loads(line)
            res[e["qid"]] = e
    return res

def sauver_journal(journal: dict):
    with JOURNAL.open("w") as f:
        for e in journal.values():
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

def commons_info(nom_fichier: str) -> dict | None:
    """Récupère l'URL de la vignette 1000 px et les métadonnées de licence."""
    titre = f"File:{nom_fichier}"
    params = {
        "action": "query",
        "titles": titre,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiextmetadatafilter": "LicenseShortName|Artist|Credit|Attribution",
        "iiurlwidth": MAX_COTE,
        "format": "json",
    }
    try:
        r = requests.get("https://commons.wikimedia.org/w/api.php",
                         params=params, headers=ENTETES_COMMONS, timeout=30)
        r.raise_for_status()
        pages = r.json().get("query", {}).get("pages", {})
        for page in pages.values():
            ii = page.get("imageinfo", [{}])[0]
            meta = ii.get("extmetadata", {})
            return {
                "thumb_url": ii.get("thumburl"),
                "original_url": ii.get("url"),
                "licence": meta.get("LicenseShortName", {}).get("value", ""),
                "auteur": meta.get("Artist", {}).get("value", ""),
                "credit": meta.get("Credit", {}).get("value", ""),
                "fichier": nom_fichier,
            }
    except Exception as e:
        print(f"  ⚠ Commons API erreur pour {nom_fichier}: {e}", file=sys.stderr)
    return None

def redimensionner(data: bytes, max_cote: int) -> bytes:
    """Redimensionne en JPEG, max_cote sur la plus grande dimension."""
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    w, h = img.size
    if max(w, h) > max_cote:
        ratio = max_cote / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()

def upload_supabase(supabase_url: str, key: str, bucket: str, chemin: str, data: bytes) -> bool:
    """Upload un fichier dans le bucket Supabase Storage."""
    url = f"{supabase_url}/storage/v1/object/{bucket}/{chemin}"
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
    }
    try:
        r = requests.post(url, headers=headers, data=data, timeout=30)
        if r.status_code in (200, 201):
            return True
        print(f"  ⚠ Upload {chemin}: {r.status_code} {r.text[:200]}", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠ Upload {chemin}: {e}", file=sys.stderr)
    return False

def update_photo_url(supabase_url: str, key: str, person_id: str, photo_url: str) -> bool:
    """UPDATE people SET photo_url via l'API REST Supabase."""
    url = f"{supabase_url}/rest/v1/people?id=eq.{person_id}"
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    try:
        r = requests.patch(url, headers=headers, json={"photo_url": photo_url}, timeout=15)
        return r.status_code in (200, 204)
    except Exception as e:
        print(f"  ⚠ UPDATE photo_url {person_id}: {e}", file=sys.stderr)
        return False

def main():
    ecrire = "--ecrire" in sys.argv
    limite = None
    if "--limite" in sys.argv:
        idx = sys.argv.index("--limite")
        limite = int(sys.argv[idx + 1])

    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if ecrire and (not supabase_url or not supabase_key):
        print("ERREUR : SUPABASE_URL et SUPABASE_SERVICE_KEY requis avec --ecrire", file=sys.stderr)
        sys.exit(1)

    # Charger les personnes avec image
    personnes = []
    for line in PERSONNES.read_text().splitlines():
        p = json.loads(line)
        if p.get("image"):
            personnes.append(p)
    print(f"{len(personnes)} personnes avec image")

    if limite:
        personnes = personnes[:limite]
        print(f"  (limité à {limite})")

    journal = charger_journal()
    deja = sum(1 for p in personnes if p["qid"] in journal)
    print(f"{deja} déjà traitées, {len(personnes) - deja} restantes")

    ok, ko, sautes = 0, 0, 0
    credits_list = []

    for i, p in enumerate(personnes):
        if p["qid"] in journal:
            # Récupérer les crédits existants
            j = journal[p["qid"]]
            if j.get("ok"):
                credits_list.append({
                    "person_id": p["id"],
                    "personne": f"{p['first_name']} {p['last_name']}",
                    "fichier": j.get("fichier", ""),
                    "auteur": texte_brut(j.get("auteur", "")),
                    "licence": j.get("licence", ""),
                    "url": f"https://commons.wikimedia.org/wiki/File:{quote(j.get('fichier', ''))}",
                })
            sautes += 1
            continue

        # 1. Commons API
        info = commons_info(p["image"])
        if not info or not info["thumb_url"]:
            journal[p["qid"]] = {"qid": p["qid"], "ok": False, "motif": "pas de vignette Commons"}
            ko += 1
            if (i + 1) % LOT == 0:
                sauver_journal(journal)
            continue

        if not info["licence"]:
            journal[p["qid"]] = {"qid": p["qid"], "ok": False, "motif": "licence non lisible"}
            ko += 1
            if (i + 1) % LOT == 0:
                sauver_journal(journal)
            continue

        # 2. Télécharger la vignette
        try:
            r = requests.get(info["thumb_url"], headers=ENTETES_COMMONS, timeout=60)
            r.raise_for_status()
            img_data = r.content
        except Exception as e:
            journal[p["qid"]] = {"qid": p["qid"], "ok": False, "motif": f"téléchargement: {e}"}
            ko += 1
            continue

        # 3. Redimensionner
        try:
            plein = redimensionner(img_data, MAX_COTE)
            vignette = redimensionner(img_data, VIGNETTE_COTE)
        except Exception as e:
            journal[p["qid"]] = {"qid": p["qid"], "ok": False, "motif": f"redimensionnement: {e}"}
            ko += 1
            continue

        ts = int(time.time() * 1000)
        chemin_plein = f"{p['id']}/{ts}.jpg"
        chemin_vignette = f"vignettes/{p['id']}/{ts}.jpg"

        if ecrire:
            # 4. Upload
            if not upload_supabase(supabase_url, supabase_key, "visages", chemin_plein, plein):
                journal[p["qid"]] = {"qid": p["qid"], "ok": False, "motif": "upload plein échoué"}
                ko += 1
                continue
            if not upload_supabase(supabase_url, supabase_key, "visages", chemin_vignette, vignette):
                journal[p["qid"]] = {"qid": p["qid"], "ok": False, "motif": "upload vignette échoué"}
                ko += 1
                continue
            # 5. UPDATE photo_url
            if not update_photo_url(supabase_url, supabase_key, p["id"], chemin_plein):
                journal[p["qid"]] = {"qid": p["qid"], "ok": False, "motif": "UPDATE photo_url échoué"}
                ko += 1
                continue

        journal[p["qid"]] = {
            "qid": p["qid"],
            "ok": True,
            "fichier": info["fichier"],
            "auteur": info["auteur"],
            "licence": info["licence"],
            "chemin": chemin_plein,
            "dry_run": not ecrire,
        }
        credits_list.append({
            "person_id": p["id"],
            "personne": f"{p['first_name']} {p['last_name']}",
            "fichier": info["fichier"],
            "auteur": texte_brut(info["auteur"]),
            "licence": info["licence"],
            "url": f"https://commons.wikimedia.org/wiki/File:{quote(info['fichier'])}",
        })
        ok += 1

        if (i + 1) % LOT == 0:
            sauver_journal(journal)
            print(f"  lot {(i+1)//LOT} : {ok} ok, {ko} ko, {sautes} sautés")
            time.sleep(1)  # politesse Commons

    sauver_journal(journal)

    # Générer credits-photos.json
    credits_list.sort(key=lambda x: x["personne"])
    CREDITS.write_text(json.dumps(credits_list, ensure_ascii=False, indent=2))

    print(f"\nTerminé : {ok} ok, {ko} ko, {sautes} sautés (déjà faits)")
    print(f"  → {JOURNAL}")
    print(f"  → {CREDITS} ({len(credits_list)} crédits)")
    if not ecrire:
        print("  (dry-run — relancer avec --ecrire pour uploader)")

if __name__ == "__main__":
    main()
