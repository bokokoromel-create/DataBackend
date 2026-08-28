# Data Horizon — API backend

API Node.js (Express 5 + Prisma 7 + Supabase Auth/Storage) qui sert le front Next.js Data Horizon.

- **Auth** : Supabase (JWT côté front, validation `auth.getUser` côté backend)
- **Données** : PostgreSQL via Prisma (driver adapter `@prisma/adapter-pg`)
- **Fichiers** : Supabase Storage (diplômes privés, images d’événements publiques)
- **Temps réel** : Server-Sent Events (`GET /events`)
- **Version** : `1.2.0` (cf. `package.json` et `GET /health`)

---

## 1. Démarrage rapide

```bash
cp .env.example .env       # remplir les valeurs (cf. § Variables)
npm install                # installe Prisma + dépendances et exécute prisma generate
npx prisma migrate deploy  # applique les migrations sur la base
npm run seed:zones         # peuple le référentiel des zones administratives (carte admin)
npm run dev                # http://localhost:4000 (nodemon + ts-node)
```

Vérification : `GET /health` → `{"status":"ok","version":"1.2.0"}`.

Sur une base déjà en prod (comptes existants avant `ZoneAdministrative`), lancer aussi
`npm run backfill:zones` une fois après le déploiement pour résoudre `zoneAdministrativeId`
sur les utilisateurs déjà inscrits.

### Scripts npm

| Script                  | Description                                                |
|-------------------------|------------------------------------------------------------|
| `npm run dev`           | Serveur en watch mode (`nodemon` + `ts-node`)              |
| `npm run start:dev`     | Lance le serveur via `ts-node` (sans watch)                |
| `npm run build`         | `prisma generate` + `tsc` → `dist/`                        |
| `npm start`             | Lance `node dist/index.js` (production)                    |
| `npm run typecheck`     | `tsc --noEmit` (CI)                                        |
| `npm run probe:stats`   | Sonde locale : recalcule `/admin/stats` depuis la base     |
| `npm run probe:storage` | Sonde locale : upload/list/delete sur le bucket diplômes   |
| `npm run probe:rapports`| Sonde HTTP : `GET /admin/rapports/<periode>`               |
| `npm run probe:diplome-upload` | Sonde HTTP : flux complet `POST /me/diplome`        |
| `npm run probe:carte`   | Sonde HTTP : `GET /admin/zones` + `GET /admin/carte`       |
| `npm run seed:zones`    | Peuple les 15 secteurs administratifs (Brazzaville/Pointe-Noire) |
| `npm run backfill:zones`| Résout `zoneAdministrativeId` pour les comptes existants   |

---

## 2. Variables d’environnement

| Variable                         | Rôle                                                                            |
|----------------------------------|---------------------------------------------------------------------------------|
| `DATABASE_URL`                   | Postgres pooler Supabase (`6543`, `?pgbouncer=true`) — runtime                  |
| `DIRECT_URL`                     | Postgres direct Supabase (`5432`) — migrations                                  |
| `SUPABASE_URL`                   | `https://<project-ref>.supabase.co`                                             |
| `SUPABASE_SERVICE_ROLE_KEY`      | Clé **service_role** (jamais la clé anon)                                       |
| `CORS_ORIGIN` *(ou `FRONTEND_URL`)* | Origine autorisée (ex. `https://datahorizon.vercel.app`)                     |
| `PORT`                           | Port HTTP (défaut `4000`, injecté par Railway en prod)                          |
| `JSON_BODY_LIMIT`                | Limite Express JSON (défaut `1mb`)                                              |
| `SUPABASE_DIPLOMES_BUCKET`       | Nom bucket diplômes (défaut `diplomes`, **privé**, créé auto)                   |
| `DIPLOME_MAX_BYTES`              | Taille max upload diplôme (défaut `4194304` = 4 Mo)                             |
| `DIPLOME_SIGNED_URL_SECONDS`     | Durée des URLs signées de téléchargement (défaut `300`)                         |
| `SUPABASE_EVENEMENTS_BUCKET`     | Nom bucket images événements (défaut `evenements`, **public**, créé auto)       |

Les buckets Supabase Storage sont créés automatiquement au premier upload. Inutile de les pré-créer.

---

## 3. Routes

### Public

| Méthode | Route              | Description                                  |
|---------|--------------------|----------------------------------------------|
| `GET`   | `/`                | Bandeau identification API + version         |
| `GET`   | `/health`          | Sonde santé (`status`, `version`)            |
| `POST`  | `/inscription/`    | Crée un participant (Supabase Auth + `User`) |
| `POST`  | `/admin/register`  | Crée un compte admin                         |
| `POST`  | `/admin/login`     | Login admin → `access_token` Supabase        |

### Participant (`Authorization: Bearer <access_token>`)

| Méthode      | Route                                          | Description                                              |
|--------------|------------------------------------------------|----------------------------------------------------------|
| `GET`        | `/me/`                                         | Profil + statut questionnaire/diplôme/auth               |
| `PATCH`      | `/me/`                                         | Met à jour profil (`prenom`, `nom`, `ville`, …)          |
| `POST`       | `/me/provision`                                | Crée le profil métier pour un JWT Auth déjà existant     |
| `POST`       | `/me/questionnaire/`                           | Upsert questionnaire (Postgres + sync `user_metadata`)   |
| `GET`        | `/me/evenements`                               | Fil publications (filtres `?day=YYYY-MM-DD`, `publishedFrom/To`) |
| `GET`        | `/me/sondages`                                 | Sondages actifs (`?type=rapide&#124;consultation`)            |
| `POST`       | `/me/sondages/:id/reponse`                     | Vote                                                     |
| `GET/POST/PUT` | `/me/diplome`                                | Lit / dépose son diplôme (multipart, champ `file`)       |
| `GET/POST`   | `/me/publications/:id/reactions`               | Liste / pose une réaction (`utile`/`interessant`/`a_suivre`) |
| `GET/POST`   | `/me/publications/:id/commentaires`            | Liste / publie un commentaire                            |
| `GET`        | `/me/gamification`                             | Compteurs + badges                                       |
| `POST`       | `/me/gamification/publication-vue`             | Marque une publication vue (idempotent)                  |
| `POST`       | `/me/gamification/consultation-completee`      | +1 consultation complétée                                |
| `GET`        | `/me/opportunites`                             | Liste des opportunités                                   |

### Admin (`Authorization: Bearer <access_token>` admin)

| Méthode      | Route                                  | Description                                            |
|--------------|----------------------------------------|--------------------------------------------------------|
| `POST`       | `/admin/logout`                        | Révoque la session Supabase courante (scope `local`)   |
| `PATCH`      | `/admin/me`                            | Met à jour le profil + email/mot de passe Auth         |
| `GET`        | `/admin/export`                        | Export participants (filtres démographiques en query)  |
| `GET`        | `/admin/stats`                         | KPIs (mêmes filtres que `/admin/export`)               |
| `GET/POST/DELETE` | `/admin/evenements`               | CRUD événements (image multipart sur `POST`)           |
| `GET/POST/DELETE` | `/admin/sondages`                 | CRUD sondages                                          |
| `GET`        | `/admin/sondages/stats`                | Tableau de comptage des réponses par option            |
| `GET`        | `/admin/diplomes`                      | Liste diplômes + URLs signées de téléchargement        |
| `GET`        | `/admin/diplomes/:id`                  | Détail d’un diplôme                                    |
| `GET/POST`   | `/admin/opportunites`                  | Liste / crée une opportunité                           |
| `GET`        | `/admin/rapports/:periode`             | Export CSV mensuel (`YYYY-MM`)                         |
| `GET`        | `/admin/zones?ville=`                  | Référentiel ville → secteur (carte admin)              |
| `GET`        | `/admin/carte?ville=&secteurId=&quartierId=` | Compteurs agrégés par zone + besoin dominant (seuil confidentialité = 3) |

### Temps réel (SSE)

```text
GET /events?scope=admin&token=<ACCESS_TOKEN>
```

`EventSource` ne supporte pas l’en-tête `Authorization`, on accepte donc le JWT en query (`token` ou `access_token`). En dev, sans `scope=admin`, le flux est ouvert (utile pour debug front).

Événements émis : `participant.created`, `participant.questionnaire.updated`, `evenement.updated`, `sondage.updated`, `admin.profile.updated`.

---

## 4. Filtres `/admin/export` & `/admin/stats`

Tous optionnels, combinables :

- `ageMin`, `ageMax` — bornes incluses
- `sexe` — comparaison insensible à la casse (`?sexe=femme`)
- `arrondissement` — comparaison insensible à la casse
- `niveauEtude` — filtre côté questionnaire (insensible aux accents)

Réponse `/admin/stats` (alignée `src/types/front-contract.ts`) :

```json
{
  "totalUsers": 14,
  "totalQuestionnaires": 7,
  "totalDiplomes": 3,
  "parVille": [{ "ville": "Brazzaville", "count": 14 }],
  "totalObstaclesSelectionnes": 15,
  "besoinsParType": [{ "label": "Trouver un emploi", "count": 5 }],
  "prioritesParZone": [
    { "ville": "Brazzaville", "besoinPrincipal": "Obtenir un financement", "obstacles": 15 }
  ],
  "utilisateursActifsMensuels": 9,
  "parThematique": [
    { "thematique": "Emploi", "count": 5 },
    { "thematique": "Formation", "count": 2 },
    { "thematique": "Entrepreneuriat", "count": 4 },
    { "thematique": "Numérique", "count": 1 },
    { "thematique": "Santé", "count": 1 },
    { "thematique": "Participation citoyenne", "count": 0 }
  ]
}
```

---

## 5. Diplômes (Supabase Storage)

- Bucket privé `SUPABASE_DIPLOMES_BUCKET` (défaut `diplomes`), créé automatiquement.
- Upload : `POST /me/diplome` — `multipart/form-data`, champ **`file`** (PDF/JPEG/PNG/WebP, ≤ 4 Mo).
- Stockage : `{supabaseId}/{diplomeId}.{ext}` ; métadonnées en table `Diplome`.
- Téléchargement : URL signée (`downloadUrl`, durée `DIPLOME_SIGNED_URL_SECONDS`).

> ⚠️ Le service-role Supabase **bypass** les RLS Storage. Les uploads passent **uniquement** par cette API (pas d’upload direct depuis le navigateur), garantissant l’écriture même avec des policies strictes côté Storage.

---

## 6. Événements / Publications

`POST /admin/evenements` accepte `multipart/form-data` : tous les champs texte plus une image optionnelle (champ `image`, jpeg/png/webp/gif, ≤ 5 Mo).

Catégories acceptées (libre, mais validées) : `concours`, `bourse`, `formation`, `emploi`, `evenement`, `entrepreneuriat`, `numerique`, `innovation`.

L’image est uploadée dans le bucket `evenements` (créé auto, public). En cas d’échec Storage, l’événement est rollbacké.

---

## 7. Schéma Prisma (résumé)

| Modèle                    | Notes                                                                  |
|---------------------------|------------------------------------------------------------------------|
| `User`                    | `supabaseId` unique, `lastActiveAt` pour le MAU, `age`/`sexe` optionnels, `zoneAdministrativeId` optionnel |
| `Diplome`                 | 1-1 `User`, `storagePath` Supabase Storage                             |
| `Questionnaire`           | 1-1 `User`, `reponses Json`                                            |
| `Evenement`               | `imageUrl`, `categorie`, `createdAt` (= date de publication)           |
| `Sondage` / `SondageReponse` | `type` ∈ {`rapide`, `consultation`}                                 |
| `PublicationReaction`     | `(publicationId, userId)` unique, type ∈ {`utile`, `interessant`, `a_suivre`} |
| `PublicationCommentaire`  | Commentaires libres associés à une publication                          |
| `Opportunite`             | `type`, `titre`, `echeanceAt`, `lien`, `imageUrl`                      |
| `UserGamification`        | Compteurs `publicationsConsultees`, `consultationsCompletees`, `membresInvites` |
| `ZoneAdministrative`      | Référentiel `ville` → `SECTEUR`/`QUARTIER` (hiérarchie `parentId`), centroïde `latitude`/`longitude`, pour la carte admin |
| `AdminUser`               | Compte admin lié à un Supabase Auth user                               |

Migrations : voir `prisma/migrations/`.

---

## 8. Déploiement

### Image Docker (Railway / Docker Hub)

```bash
docker build --build-arg API_VERSION=$(node -p "require('./package.json').version") -t datahorizon-api:1.2.0 .
docker run --env-file .env -p 4000:4000 datahorizon-api:1.2.0
```

Le conteneur exécute `npx prisma migrate deploy` puis `node dist/index.js`. Healthcheck Docker : `GET /health`.

Script `deploy.sh` :

```bash
export DOCKER_USER=<ton-user-dockerhub>
./deploy.sh   # build + push :version + :latest
```

### Railway / Vercel

- **Backend (Railway)** : variables identiques au tableau ci-dessus. Vérifie que la dernière commit `main` est bien déployée (Deployments).
- **Front (Vercel)** : `NEXT_PUBLIC_API_URL` et `API_URL` doivent pointer sur l’URL Railway **sans** slash final.

---

## 9. Tests rapides (curl)

```bash
API="http://localhost:4000"

curl "$API/health"

# Inscription
curl -X POST "$API/inscription/" -H "Content-Type: application/json" -d '{
  "prenom":"Marie","nom":"Dupont","email":"marie@example.cg","motDePasse":"Pass!123",
  "ville":"Brazzaville","age":24,"sexe":"femme"
}'

# Login admin
TOKEN=$(curl -s -X POST "$API/admin/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@…","motDePasse":"…"}' | jq -r .access_token)

curl "$API/admin/stats?ageMin=18&sexe=femme" -H "Authorization: Bearer $TOKEN"
curl "$API/admin/rapports/2026-06" -H "Authorization: Bearer $TOKEN" -o rapport.csv

# Carte admin (zones)
curl "$API/admin/zones?ville=Brazzaville" -H "Authorization: Bearer $TOKEN"
curl "$API/admin/carte?ville=Brazzaville" -H "Authorization: Bearer $TOKEN"
```

---

## 10. Dépannage

| Symptôme                                              | Cause probable                                                                  | Action                                                                 |
|-------------------------------------------------------|---------------------------------------------------------------------------------|------------------------------------------------------------------------|
| `EADDRINUSE` au démarrage                             | Port 4000 déjà occupé par un autre `node`                                       | Windows : `netstat -ano \| findstr :4000` puis `taskkill /PID <pid> /F` |
| `404 USER_ROW_NOT_FOUND_FOR_JWT`                      | Compte Auth présent mais pas de ligne `User`                                    | Appeler `POST /me/provision` ou `POST /inscription/`                   |
| `502 STORAGE_UPLOAD_FAILED` + « row-level security »  | Clé `SUPABASE_SERVICE_ROLE_KEY` manquante / incorrecte (ou clé anon utilisée)   | Remplacer par la **service_role** dans les variables                   |
| `502 SUPABASE_USER_METADATA_SYNC_FAILED`              | JSON questionnaire trop gros (limites Supabase Auth)                            | Réduire la taille des réponses, ou éclater en sous-objets              |
| `500 DB_AUTH_FAILED`                                  | Mauvais `DATABASE_URL`/`DIRECT_URL`                                             | Vérifier les credentials Supabase pooler                               |
| Stats `0` partout sur le dashboard                    | Bearer admin manquant, mauvais projet, questionnaires vides                     | Voir la sonde `npm run probe:stats`                                    |

---

## 11. Contrat front

Le fichier `src/types/front-contract.ts` est la source de vérité des payloads échangés (à dupliquer côté front ou à publier comme package partagé). Les SSE émis ont un type `SseEvent` également exporté.
