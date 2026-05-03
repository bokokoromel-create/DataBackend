/**
 * Contrat API ↔ front : mêmes noms que `DonneesInscriptionProfil` / `ProfilReponses` côté app.
 * Le front peut copier ce fichier ou le dupliquer pour rester aligné.
 */

/**
 * Body JSON de `POST /inscription/`.
 * Le champ API est `telephone` ; si le formulaire local utilise `numero`, le mappeur front doit envoyer `telephone`.
 */
export interface DonneesInscriptionProfil {
  prenom: string;
  nom: string;
  email: string;
  motDePasse: string;
  ville: string;
  arrondissement?: string | null;
  telephone?: string | null;
}

/**
 * Body JSON de `POST /me/questionnaire/` — persisté tel quel dans `Questionnaire.reponses` (colonne JSON).
 * Côté front : typage strict + réexport (ex. `profil-local-storage`). Tant que ce type n’est pas dupliqué ici,
 * le backend accepte tout objet JSON ; dès que la forme est figée, duplique l’interface front dans ce fichier
 * (ou partage un package `@datahorizon/contracts`) pour une vérif compile-time identique.
 */
export type ProfilReponses = Record<string, unknown>;

/** Body `POST /admin/register` */
export interface DonneesInscriptionAdmin {
  nomComplet: string;
  email: string;
  motDePasse: string;
  nomOrganisation: string;
  fonctionPoste: string;
  secteurInteret: string;
}

/**
 * Corps `PATCH /admin/me` (camelCase). `motDePasse` présent uniquement pour changer le mot de passe
 * (chaîne ignorée ou absente ⇒ pas de changement côté Supabase Auth).
 */
export interface AdminPatchProfil {
  nomComplet: string;
  email: string;
  nomOrganisation: string;
  fonctionPoste: string;
  secteurInteret: string;
  motDePasse?: string | null | undefined;
}
