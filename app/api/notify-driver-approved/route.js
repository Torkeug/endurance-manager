import { NextResponse } from "next/server";
import { createClient } from "../../../lib/auth";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

// POST /api/notify-driver-approved
// Sends an approval confirmation email to a driver after an admin approves them.
// Called from DriversManager.js after the DB update succeeds.
// Always returns 200 — email failure is logged but must not block the approval action.
export async function POST(req) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: requestingDriver } = await supabase
      .from("drivers")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();
    if (
      !requestingDriver ||
      !["admin", "super_admin"].includes(requestingDriver.role)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
      return NextResponse.json({ success: false, reason: "driver_not_found" });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Send via Resend using plain fetch — same pattern as notify-admins
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: driver.email,
        subject: "Votre accès Kronos a été approuvé",
        html: buildEmail({ name: driver.name, appUrl }),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[notify-driver-approved] Resend error:", text);
      return NextResponse.json({ success: false, reason: "email_failed" });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify-driver-approved] Unexpected error:", err.message);
    // Return 200 — approval already succeeded in the DB, don't surface email errors
    return NextResponse.json({ success: false, reason: "unexpected_error" });
  }
}

function buildEmail({ name, appUrl }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accès approuvé</title>
</head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Segoe UI',Arial,sans-serif;color:#e8e8e8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f13;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:1.6rem;font-weight:800;letter-spacing:0.06em;color:#e8c84b;">KRONOS</span>
              <span style="font-size:1.6rem;font-weight:300;letter-spacing:0.06em;color:#e8e8e8;">&nbsp;PLANNER</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1a1a22;border:1px solid #2a2a35;border-radius:6px;padding:32px;">
              <p style="font-size:2rem;margin:0 0 12px;text-align:center;">✅</p>
              <h1 style="margin:0 0 8px;font-size:1.2rem;font-weight:700;color:#e8e8e8;text-align:center;">
                Bienvenue, ${name} !
              </h1>
              <p style="margin:0 0 24px;font-size:0.9rem;color:#aaa;text-align:center;line-height:1.6;">
                Votre compte Kronos SimSports a été approuvé par un administrateur.<br/>
                Vous pouvez maintenant vous connecter et accéder à la plateforme.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/login"
                      style="display:inline-block;background:#e8c84b;color:#0f0f13;
                             font-weight:800;font-size:0.9rem;letter-spacing:0.06em;
                             text-decoration:none;padding:12px 32px;border-radius:4px;">
                      SE CONNECTER →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;text-align:center;font-size:0.75rem;color:#555;">
              Kronos SimSports — Cet email a été envoyé automatiquement, merci de ne pas y répondre.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
