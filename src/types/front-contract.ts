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

/** Réponse `GET /me/` — source de vérité profil + questionnaire sidebar. */
export interface ProfilMeResponse {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  ville: string;
  arrondissement: string | null;
  telephone: string | null;
  createdAt: string;
  questionnaire: {
    reponses: ProfilReponses;
    soumisAt: string;
  } | null;
}

/** Réponse `GET /admin/stats` (KPI dashboard). */
export interface StatsAdminResponse {
  totalUsers: number;
  totalQuestionnaires: number;
  totalDiplomes: number;
  totalObstaclesSelectionnes: number;
  parVille: { ville: string; count: number }[];
  besoinsParType: { label: string; count: number }[];
  prioritesParZone: {
    ville: string;
    besoinPrincipal: string;
    obstacles: number;
  }[];
}

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

/** Ligne participant renvoyée dans les SSE et l’export admin. */
export interface ParticipantResume {
  idParticipant: string;
  prenom: string;
  nom: string;
  email: string;
  ville: string;
  statut: string;
  inscriptionAt: string;
  questionnaireSoumisAt: string | null;
  questionnaireComplet: boolean;
}

/** Événements SSE (`GET /events?scope=admin&token=...`). */
export type SseEvent =
  | { type: "hello"; data: { scope: "public" | "admin" } }
  | { type: "participant.created"; data: { participant: ParticipantResume } }
  | {
      type: "participant.questionnaire.updated";
      data: { reason: string; idParticipant?: string };
    }
  | { type: "evenement.updated"; data: { reason: string } }
  | { type: "sondage.updated"; data: { reason: string } }
  | { type: "admin.profile.updated"; data: { reason: string } };
