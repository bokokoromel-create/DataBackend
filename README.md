# Data Horizon — API backend

API Node.js (Express + Prisma + Supabase Auth/Storage) pour le front Next.js Data Horizon.

## Démarrage local

```bash
cp .env.example .env   # puis remplir les valeurs
npm install
npx prisma migrate deploy
npm run dev            # http://localhost:4000
```

Santé : `GET /health` → `{ "status": "ok", "version": "1.0.1" }` (vérifie que Railway a bien redéployé).

## Routes principales

| Zone | Méthode | Route | Auth |
|------|---------|-------|------|
| Inscription | `POST` | `/inscription/` | Public |
| Profil | `GET` | `/me/` | Bearer participant |
| Questionnaire | `POST` | `/me/questionnaire/` | Bearer participant |
| Événements (fil) | `GET` | `/me/evenements` | Bearer participant |
| Sondages | `GET` | `/me/sondages` | Bearer participant |
| Réponse sondage | `POST` | `/me/sondages/:id/reponse` | Bearer participant |
| Diplôme | `POST` / `PUT` / `GET` | `/me/diplome` | Bearer participant (multipart `file`) |
| Admin login | `POST` | `/admin/login` | Public |
| Admin register | `POST` | `/admin/register` | Public |
| Admin logout | `POST` | `/admin/logout` | Bearer admin |
| KPI dashboard | `GET` | `/admin/stats` | Bearer admin |
| Export participants | `GET` | `/admin/export` | Bearer admin |
| Diplômes (liste) | `GET` | `/admin/diplomes` | Bearer admin |
| Événements CRUD | `POST` / `GET` / `DELETE` | `/admin/evenements` | Bearer admin |
| Sondages CRUD | `POST` / `GET` / `DELETE` | `/admin/sondages` | Bearer admin |
| Stats sondages | `GET` | `/admin/sondages/stats` | Bearer admin |
| Temps réel | `GET` | `/events?scope=admin&token=…` | Token admin (query) |

Contrat partagé avec le front : `src/types/front-contract.ts`.

---

## Questionnaire (source de vérité = PostgreSQL)

`POST /me/questionnaire/` enregistre le JSON **tel quel** dans `Questionnaire.reponses` (Prisma), lié à l’utilisateur via `userId`. Une synchro vers `user_metadata` Supabase Auth est tentée ; en cas d’échec, l’écriture Postgres est annulée.

Exemple de corps (aligné front) :

```json
{
  "statut": "Étudiant",
  "niveauEtude": "Baccalauréat",
  "besoinPrincipal": "Trouver un emploi",
  "obstacles": ["Manque de formation", "Manque de financement"],
  "opportuniteRatee": "Non",
  "partageDonnees": "Oui",
  "rassurerait": "",
  "recommander": "Oui",
  "nombreInvites": "2"
}
```

Libellés `besoinPrincipal` attendus (casse respectée côté front) :

- `Trouver un emploi`
- `Accéder à une formation`
- `Lancer une activité`
- `Obtenir un financement`

`GET /me/` renvoie :

```json
{
  "id": "uuid",
  "prenom": "…",
  "nom": "…",
  "email": "…",
  "ville": "…",
  "questionnaire": {
    "reponses": { "besoinPrincipal": "…", "obstacles": ["…"] },
    "soumisAt": "2026-05-25T10:00:00.000Z"
  }
}
```

---

## `GET /admin/export` (dashboard — liste détaillée)

**Auth :** `Authorization: Bearer <access_token admin>` (`POST /admin/login`).

Réponse : enveloppe `{ "participants": [ … ], "parStatut": [ … ], … }`. Chaque participant inclut les champs du questionnaire **à la racine** (le front accepte aussi `questionnaire.reponses` imbriqué) :

| Champ | Description |
|-------|-------------|
| `idParticipant` | UUID user |
| `email`, `nom`, `prenom`, `ville` | Identité |
| `statut` | Déduit du JSON (`statut`, etc.) |
| `besoinPrincipal` | Ex. `Trouver un emploi` |
| `obstacles` | Tableau de chaînes |
| `obstaclesText` | `"A ; B ; C"` |
| `questionnaireComplet` | `true` si `besoinPrincipal` non vide |
| `inscriptionAt`, `enregistreLe` | ISO date |

Exemple (extrait) :

```json
{
  "participants": [
    {
      "idParticipant": "uuid",
      "email": "a@exemple.cg",
      "nom": "Dupont",
      "prenom": "Marie",
      "ville": "Brazzaville",
      "statut": "Étudiant",
      "besoinPrincipal": "Trouver un emploi",
      "obstacles": ["Manque de formation", "Manque de financement"],
      "obstaclesText": "Manque de formation ; Manque de financement",
      "questionnaireComplet": true
    }
  ]
}
```

---

## `GET /admin/stats` (dashboard — agrégats)

**Auth :** Bearer admin (obligatoire).

```json
{
  "totalUsers": 14,
  "totalQuestionnaires": 7,
  "totalDiplomes": 0,
  "totalObstaclesSelectionnes": 15,
  "parVille": [{ "ville": "Brazzaville", "count": 14 }],
  "besoinsParType": [
    { "label": "Trouver un emploi", "count": 1 },
    { "label": "Accéder à une formation", "count": 2 },
    { "label": "Lancer une activité", "count": 2 },
    { "label": "Obtenir un financement", "count": 2 }
  ],
  "prioritesParZone": [
    {
      "ville": "Brazzaville",
      "besoinPrincipal": "Obtenir un financement",
      "obstacles": 15
    }
  ]
}
```

| Champ | Règle |
|-------|--------|
| `totalUsers` | `User` count |
| `totalQuestionnaires` | Questionnaires avec `besoinPrincipal` non vide |
| `totalDiplomes` | Lignes table `Diplome` |
| `totalObstaclesSelectionnes` | Somme des tailles du tableau `obstacles` |
| `besoinsParType` | Les 4 libellés canoniques + counts (0 si absent) |
| `prioritesParZone` | Par ville : besoin le plus fréquent + total obstacles |

---

## Admin — auth

```http
POST /admin/login
Content-Type: application/json

{ "email": "admin@…", "motDePasse": "…" }
```

Réponse : `{ "access_token", "refresh_token", "expires_in", "token_type" }`.

```http
POST /admin/logout
Authorization: Bearer <access_token>
```

Révoque la session courante côté Supabase (`scope: local`). Le JWT access reste valide jusqu’à expiration.

---

## Diplômes (Supabase Storage)

1. Bucket **privé** `diplomes` (ou `SUPABASE_DIPLOMES_BUCKET`).
2. Migration `20260526120000_diplomes`.
3. Upload : `POST /me/diplome` — `multipart/form-data`, champ **`file`** (PDF, JPEG, PNG, WebP, max 4 Mo).
4. Fichiers sous `{supabaseId}/{diplomeId}.pdf` dans le bucket ; métadonnées en table `Diplome`.
5. Téléchargement via `downloadUrl` (URL signée, durée `DIPLOME_SIGNED_URL_SECONDS`, défaut 300 s).

**Erreur « row-level security policy »** : exécuter une fois dans Supabase → SQL Editor le fichier `prisma/supabase/diplomes-rls.sql`. Vérifier `SUPABASE_SERVICE_ROLE_KEY` sur Railway (pas la clé anon).

---

## SSE admin

`EventSource` n’envoie pas toujours les en-têtes : passer le token en query.

```text
GET /events?scope=admin&token=<ACCESS_TOKEN>
```

En production, token admin requis. Événements : `participant.created`, `participant.questionnaire.updated`, `evenement.updated`, `sondage.updated`.

---

## Déploiement (Railway / Docker)

Image **1.0.1** — build multi-stage Alpine, utilisateur non-root, healthcheck sur `/health`.

```bash
docker build -t datahorizon-api:1.0.1 .
docker run --env-file .env -p 4000:4000 datahorizon-api:1.0.1
```

Le conteneur exécute `prisma migrate deploy` puis `node dist/index.js`. Variables d’environnement identiques à Railway (voir ci-dessous).

Variables **obligatoires** sur la plateforme :

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Postgres pooler Supabase (`6543`, `?pgbouncer=true`) |
| `DIRECT_URL` | Connexion directe (`5432`, migrations) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé **service_role** (pas anon) |
| `CORS_ORIGIN` | URL du front (ex. `https://….vercel.app`) |
| `PORT` | `4000` (souvent injecté par Railway) |

Optionnel : `SUPABASE_DIPLOMES_BUCKET`, `DIPLOME_MAX_BYTES`, `DIPLOME_SIGNED_URL_SECONDS`, `JSON_BODY_LIMIT`.

Front Vercel : `NEXT_PUBLIC_API_URL` et `API_URL` = URL Railway **sans** `/` final.

Après chaque push sur `main`, vérifier que Railway déploie le **dernier commit** (Deployments). Local et prod partagent la même base si `DATABASE_URL` pointe vers le même projet Supabase.

---

## Tests rapides (curl)

```bash
# Login admin
curl -s -X POST "$API/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"…","motDePasse":"…"}'

# Export (obstacles / besoinPrincipal)
curl -s "$API/admin/export" -H "Authorization: Bearer $TOKEN"

# Stats agrégées
curl -s "$API/admin/stats" -H "Authorization: Bearer $TOKEN"
```

Scripts locaux : `npx ts-node scripts/probe-stats.ts`, `probe-questionnaires.ts`, `probe-storage.ts`, `probe-http.ts` (nécessite `npm run dev` pour le HTTP).

---

## Dépannage dashboard « obstacles / besoins à 0 »

1. **Même base** : local et Railway doivent utiliser le même `DATABASE_URL` pour voir les mêmes données.
2. **Code déployé** : commit récent (`32fc54b+`) avec export enrichi + stats agrégées.
3. **Clé Supabase** : `SUPABASE_SERVICE_ROLE_KEY` = service_role du bon projet.
4. **Bearer admin** : `/admin/stats` et `/admin/export` exigent le token ; sans lui → `401` et graphiques vides côté front.
5. **Questionnaires** : vérifier que `POST /me/questionnaire/` a bien été appelé après inscription (champs `besoinPrincipal`, `obstacles` dans `reponses`).
