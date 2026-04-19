import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/notify-driver-approved
// Sends an approval confirmation email to a driver after an admin approves them.
// Called from DriversManager.js after the DB update succeeds.
// Always returns 200 — email failure is logged but must not block the approval action.
export async function POST(req) {
  try {
    const { driver_id } = await req.json();
    if (!driver_id) {
      return NextResponse.json(
        { error: "driver_id manquant." },
        { status: 400 },
      );
    }

    // Fetch the driver's name and email via service role (bypasses RLS)
    const { data: driver, error: driverErr } = await supabase
      .from("drivers")
      .select("name, email")
      .eq("id", driver_id)
      .single();

    if (driverErr || !driver?.email) {
      console.error(
        "[notify-driver-approved] Driver fetch failed:",
        driverErr?.message,
      );
      // Return 200 — approval already succeeded in the DB, don't surface email errors
      return NextResponse.json({ success: false, reason: "driver_not_found" });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://kronos-simsports.com";

    const { error: emailErr } = await resend.emails.send({
      from: "Kronos SimSports <no-reply@kronos-simsports.com>",
      to: driver.email,
      subject: "Votre accès Kronos a été approuvé",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #e0e0e0; background: #111; padding: 32px; border-radius: 6px;">
          <img src="${appUrl}/kronos-logo-text.png" alt="Kronos SimSports" style="height: 40px; margin-bottom: 24px; display: block;" />
          <h2 style="margin: 0 0 12px; color: #ffffff;">Bienvenue, ${driver.name} !</h2>
          <p style="margin: 0 0 16px; line-height: 1.6; color: #aaa;">
            Votre compte Kronos SimSports a été approuvé par un administrateur.
            Vous pouvez maintenant vous connecter et accéder à la plateforme.
          </p>
          <a href="${appUrl}/login"
            style="display: inline-block; padding: 10px 24px; background: #e8b84b; color: #111;
                   font-weight: 700; border-radius: 4px; text-decoration: none; font-size: 15px;">
            Se connecter →
          </a>
          <p style="margin: 24px 0 0; font-size: 12px; color: #555;">
            Kronos SimSports · Ce message est envoyé automatiquement, merci de ne pas y répondre.
          </p>
        </div>
      `,
    });

    if (emailErr) {
      console.error("[notify-driver-approved] Resend error:", emailErr);
      return NextResponse.json({ success: false, reason: "email_failed" });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify-driver-approved] Unexpected error:", err.message);
    // Return 200 — approval already succeeded, don't surface email errors to the UI
    return NextResponse.json({ success: false, reason: "unexpected_error" });
  }
}
