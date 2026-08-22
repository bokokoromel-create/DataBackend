import { Router } from "express";
import { inscriptionInvalidBody } from "../lib/exampleCurls";
import {
  parseInscriptionDemographics,
  SEXE_INVALID_MESSAGE,
} from "../lib/inscriptionDemographics";
import {
  createParticipantUser,
  isAuthEmailAlreadyRegistered,
} from "../lib/participantUser";
import { prisma } from "../lib/prisma";
import { signInUserWithPassword, supabase } from "../lib/supabase";
import type {
  DonneesInscriptionProfil,
  ParticipantResume,
} from "../types/front-contract";
import { broadcast } from "../events/sse";

const router = Router();

router.post("/", async (req, res) => {
  if (
    req.body == null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json(inscriptionInvalidBody());
  }

  const {
    prenom,
    nom,
    email,
    motDePasse,
    ville,
    arrondissement,
    telephone,
    age: ageRaw,
    sexe: sexeRaw,
  } = req.body as DonneesInscriptionProfil;

  const emailNorm = email?.trim().toLowerCase();
  if (
    typeof prenom !== "string" ||
    !prenom.trim() ||
    typeof nom !== "string" ||
    !nom.trim() ||
    typeof emailNorm !== "string" ||
    !emailNorm ||
    typeof motDePasse !== "string" ||
    !motDePasse ||
    typeof ville !== "string" ||
    !ville.trim()
  ) {
    return res.status(422).json({
      message:
        "Champs requis: prenom, nom, email, motDePasse, ville (strings non vides).",
      error: "VALIDATION_MISSING_FIELDS",
    });
  }

  const demo = parseInscriptionDemographics({ age: ageRaw, sexe: sexeRaw });
  if (!demo.ok) {
    return res.status(400).json({ message: demo.message });
  }

  // Nouvelles inscriptions : sexe obligatoire (homme | femme).
  if (demo.sexe == null) {
    return res.status(400).json({ message: SEXE_INVALID_MESSAGE });
  }

  const existingProfile = await prisma.user.findUnique({
    where: { email: emailNorm },
  });
  if (existingProfile) {
    return res.status(409).json({
      message: "Un profil existe déjà pour cet e-mail. Connecte-toi.",
      error: "EMAIL_ALREADY_REGISTERED",
    });
  }

  let supabaseId: string;

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: emailNorm,
      password: motDePasse,
      email_confirm: true,
    });

  if (authError) {
    if (!isAuthEmailAlreadyRegistered(authError.message)) {
      return res.status(400).json({
        message: authError.message,
        error: "SUPABASE_AUTH_CREATE_FAILED",
      });
    }

    const { data: signin, error: signErr } = await signInUserWithPassword(
      emailNorm,
      motDePasse,
    );
    if (signErr || !signin.user) {
      return res.status(400).json({
        message:
          "Cet e-mail existe déjà dans Auth. Utilise le mot de passe de ton inscription ou réinitialise-le.",
        error: "AUTH_EMAIL_EXISTS_PASSWORD_MISMATCH",
      });
    }
    supabaseId = signin.user.id;
  } else {
    supabaseId = authData.user.id;
  }

  try {
    const user = await createParticipantUser({
      supabaseId,
      prenom: prenom.trim(),
      nom: nom.trim(),
      email: emailNorm,
      ville: ville.trim(),
      arrondissement: arrondissement ?? null,
      telephone: telephone ?? null,
      age: demo.age,
      sexe: demo.sexe,
    });

    const participant: ParticipantResume = {
      idParticipant: user.id,
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      ville: user.ville,
      statut: "Non renseigné",
      age: user.age,
      sexe: demo.sexe,
      arrondissement: user.arrondissement,
      niveauEtude: "",
      inscriptionAt: user.createdAt.toISOString(),
      questionnaireSoumisAt: null,
      questionnaireComplet: false,
    };

    broadcast(
      { type: "participant.created", data: { participant } },
      { scope: "admin" },
    );
    return res.status(201).json({ id: user.id, email: user.email });
  } catch (err: unknown) {
    if (!authError) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
    console.error(err);
    return res.status(500).json({
      message: "Impossible d'enregistrer le profil en base.",
      error: "PRISMA_USER_CREATE_FAILED",
    });
  }
});

export default router;
