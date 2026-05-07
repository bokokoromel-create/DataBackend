/**
 * Inscription participant.
 *
 * Crée **toujours** d’abord l’utilisateur dans **Supabase Auth** (service role) avec le **même**
 * `email` + `motDePasse` que le formulaire (`email_confirm: true` pour pouvoir appeler
 * `signInWithPassword` tout de suite sans lien e-mail en dev / prod).
 *
 * Puis crée la ligne métier `User` (Prisma) liée par `supabaseId`.
 * Sans la création Auth, le front ne peut pas ouvrir de session JWT pour `/me` ou le questionnaire.
 */
import { Router } from "express";
import { inscriptionInvalidBody } from "../lib/exampleCurls";
import { prisma } from "../lib/prisma";
import { supabase } from "../lib/supabase";
import type { DonneesInscriptionProfil } from "../types/front-contract";

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
  } = req.body as DonneesInscriptionProfil;

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password: motDePasse,
      email_confirm: true,
    });

  if (authError) {
    return res.status(400).json({
      message: authError.message,
      error: "SUPABASE_AUTH_CREATE_FAILED",
    });
  }

  try {
    const user = await prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        prenom,
        nom,
        email,
        ville,
        arrondissement: arrondissement ?? null,
        telephone: telephone ?? null,
      },
    });

    return res.status(201).json({ id: user.id, email: user.email });
  } catch (err: unknown) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    console.error(err);
    return res.status(500).json({
      message:
        "Impossible d'enregistrer le profil en base. Le compte Auth créé a été annulé.",
      error: "PRISMA_USER_CREATE_FAILED",
    });
  }
});

export default router;
