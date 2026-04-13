import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

// POST /api/register-driver
// Inserts the driver record after Supabase Auth signup.
// Must be server-side because the user has no active session yet
// (email confirmation is pending), so auth.uid() is null and RLS blocks
// any direct client insert. The service role key bypasses RLS safely here
// because we validate all inputs before inserting.
export async function POST(req) {
  try {
    const { name, email, iracing_id, discord, auth_user_id } = await req.json();

    // Basic server-side validation — the client validates too, but we
    // never trust client-only validation for a DB write.
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Le nom est obligatoire." },
        { status: 400 },
      );
    }
    if (!email?.trim()) {
      return NextResponse.json(
        { error: "L'email est obligatoire." },
        { status: 400 },
      );
    }
    if (!auth_user_id) {
      return NextResponse.json(
        { error: "Identifiant utilisateur manquant." },
        { status: 400 },
      );
    }

    const { error: driverErr } = await supabase.from("drivers").insert([
      {
        name: name.trim(),
        email: email.trim(),
        iracing_id: iracing_id?.trim() || null,
        discord: discord?.trim() || null,
        auth_user_id,
        approved: false,
        role: "driver",
        active: true,
      },
    ]);

    if (driverErr) {
      // Map known Postgres error codes to explicit French messages
      if (driverErr.code === "23505") {
        // Unique constraint violation — which field?
        if (driverErr.message.includes("email")) {
          return NextResponse.json(
            {
              error:
                "Cette adresse email est déjà associée à un compte existant. Essayez de vous connecter.",
            },
            { status: 409 },
          );
        }
        if (driverErr.message.includes("iracing_id")) {
          return NextResponse.json(
            {
              error:
                "Cet iRacing ID est déjà associé à un autre compte. Vérifiez votre identifiant.",
            },
            { status: 409 },
          );
        }
        if (driverErr.message.includes("auth_user_id")) {
          return NextResponse.json(
            { error: "Un compte pilote existe déjà pour cet utilisateur." },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: "Un compte avec ces informations existe déjà." },
          { status: 409 },
        );
      }

      if (driverErr.code === "23502") {
        // Not-null violation — which field?
        const match = driverErr.message.match(/column "(.+?)"/);
        const field = match ? `"${match[1]}"` : "inconnu";
        return NextResponse.json(
          { error: `Un champ obligatoire est manquant (${field}).` },
          { status: 400 },
        );
      }

      if (driverErr.code === "42501") {
        // RLS policy violation — should not happen with service role, but just in case
        return NextResponse.json(
          {
            error:
              "Accès refusé lors de la création du profil. Contactez un administrateur.",
          },
          { status: 403 },
        );
      }

      // Unknown error — return the raw detail so it can be debugged
      console.error("[register-driver] Unexpected DB error:", driverErr);
      return NextResponse.json(
        {
          error: `Erreur lors de la création du profil : ${driverErr.message} (code : ${driverErr.code})`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[register-driver] Unexpected error:", err.message);
    return NextResponse.json(
      { error: `Erreur inattendue : ${err.message}` },
      { status: 500 },
    );
  }
}
