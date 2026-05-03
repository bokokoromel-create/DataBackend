import type {
  DonneesInscriptionAdmin,
  DonneesInscriptionProfil,
  ProfilReponses,
} from "../types/front-contract";

function baseUrl(): string {
  const port = process.env.PORT || 4000;
  return `http://localhost:${port}`;
}

/** Échappe un JSON pour l’argument -d de curl.exe sous guillemets doubles Windows. */
function escapeJsonForCurlDArg(json: string): string {
  return json.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildCurlPost(
  path: string,
  body: Record<string, unknown>,
  extraHeaders: Array<[string, string]>,
): string {
  const url = `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const escaped = escapeJsonForCurlDArg(JSON.stringify(body));
  const headers = [
    ["Content-Type", "application/json"],
    ...extraHeaders,
  ]
    .map(([k, v]) => `-H "${k}: ${v}"`)
    .join(" ");
  return `curl.exe -X POST "${url}" ${headers} -d "${escaped}"`;
}

const inscriptionExampleBody = {
  prenom: "Jean",
  nom: "Dupont",
  email: "jean.dupont@example.com",
  motDePasse: "ExempleMot2passe!",
  ville: "Paris",
  arrondissement: "75011",
  telephone: "+33600000000",
} satisfies DonneesInscriptionProfil;

const adminRegisterExampleBody = {
  nomComplet: "Marie Admin",
  email: "marie.admin@example.com",
  motDePasse: "ExempleMot2passe!",
  nomOrganisation: "DataHorizon",
  fonctionPoste: "Responsable données",
  secteurInteret: "Santé",
} satisfies DonneesInscriptionAdmin;

const questionnaireExampleBody = {
  q1: "oui",
  q2: 3,
} satisfies ProfilReponses;

export function inscriptionInvalidBody() {
  return {
    message:
      "Corps JSON requis : en-tête Content-Type: application/json et un objet JSON dans le corps (POST).",
    error: "INVALID_JSON_BODY",
    exampleBody: inscriptionExampleBody,
    exampleCurl: buildCurlPost("/inscription/", inscriptionExampleBody, []),
  };
}

export function adminRegisterInvalidBody() {
  return {
    message:
      "Corps JSON requis : en-tête Content-Type: application/json et un corps non vide.",
    error: "INVALID_JSON_BODY",
    exampleBody: adminRegisterExampleBody,
    exampleCurl: buildCurlPost(
      "/admin/register",
      adminRegisterExampleBody,
      [],
    ),
  };
}

export function questionnaireInvalidBody() {
  return {
    message:
      "Corps JSON requis : Content-Type: application/json et un objet de réponses.",
    error: "INVALID_JSON_BODY",
    exampleBody: questionnaireExampleBody,
    exampleCurl: buildCurlPost("/me/questionnaire/", questionnaireExampleBody, [
      ["Authorization", "Bearer <ACCESS_TOKEN>"],
    ]),
  };
}
