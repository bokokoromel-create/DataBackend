# Data Horizon — API backend

## Inscription + temps réel (admin)

| Objectif | Endpoint | Détail |
|----------|----------|--------|
| Recevoir l’inscription | `POST /inscription/` | Crée Supabase Auth + ligne `User` (Prisma) |
| Temps réel admin | `GET /events` | SSE ; après chaque inscription → `participant.created` |
| Totaux / KPI | `GET /admin/stats` | Utilisateurs, questionnaires, diplômes, besoins, obstacles, par ville |
| Diplômes participant | `POST/PUT/GET /me/diplome` | Multipart `file` (PDF/images, 4 Mo), Bearer participant |
| Diplômes admin | `GET /admin/diplomes`, `GET /admin/diplomes/:id` | Liste + URL signée courte |
| Déconnexion admin | `POST /admin/logout` | Bearer admin — révoque la session (`scope: local`) |
| Détail / liste | `GET /admin/export` | Liste `participants` + agrégats par statut (Bearer admin) |

### 1. Inscription participant

```http
POST /inscription/
Content-Type: application/json

{
  "prenom": "Jean",
  "nom": "Dupont",
  "email": "jean@example.com",
  "motDePasse": "…",
  "ville": "Paris",
  "arrondissement": "75011",
  "telephone": "+33600000000"
}
```

Réponse `201` : `{ "id": "…", "email": "…" }`.

### 2. Connexion SSE côté admin

`EventSource` ne peut pas envoyer `Authorization` : le jeton passe en query string.

1. `POST /admin/login` → `access_token`
2. Ouvrir le flux :

```text
GET /events?scope=admin&token=<ACCESS_TOKEN>
```

En **production** (`NODE_ENV=production`), le token admin est **obligatoire**.

Événements utiles pour le dashboard :

- `hello` — connexion établie
- `participant.created` — nouvel inscrit (`data.participant` = même forme que l’export)
- `participant.questionnaire.updated` — questionnaire soumis / mis à jour

Exemple de frame SSE :

```json
{ "type": "participant.created", "data": { "participant": { "idParticipant": "…", "prenom": "…", … } } }
```

### 3. Intégration front (React / Next)

```ts
const API = process.env.NEXT_PUBLIC_API_URL; // ex. http://localhost:4000

function connectAdminEvents(accessToken: string, onEvent: (e: SseEvent) => void) {
  const url = `${API}/events?scope=admin&token=${encodeURIComponent(accessToken)}`;
  const es = new EventSource(url);

  es.onmessage = (msg) => {
    const event = JSON.parse(msg.data) as SseEvent;
    onEvent(event);

    if (event.type === "participant.created") {
      // Ajouter la ligne au tableau OU refetch léger
      // setParticipants((prev) => [event.data.participant, ...prev]);
      // fetch(`${API}/admin/stats`).then(...) pour les compteurs
    }
  };

  es.onerror = () => es.close();
  return () => es.close();
}
```

Après `participant.created`, appeler `GET /admin/stats` pour rafraîchir les totaux (ou incrémenter `totalUsers` localement).

### 4. Stats et export

```http
GET /admin/stats
```

```http
GET /admin/export
Authorization: Bearer <ACCESS_TOKEN>
```

### 5. Diplômes (Storage Supabase)

1. Créer un bucket privé `diplomes` (ou la valeur de `SUPABASE_DIPLOMES_BUCKET`).
2. Appliquer la migration Prisma `20260526120000_diplomes`.
3. `POST /me/diplome` — `multipart/form-data`, champ `file`.

Variables d’environnement : voir `.env` (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGIN`, `PORT`, `SUPABASE_DIPLOMES_BUCKET`, `DIPLOME_SIGNED_URL_SECONDS`).
