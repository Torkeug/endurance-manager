import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

// POST /api/notify-admins
// Called after a new driver record is created during registration.
// Fetches all approved admins and super_admins, then sends each one
// a notification email via Resend. Non-critical — errors are logged
// but never surfaced to the registering user.
export async function POST(req) {
  try {
    const { name, email } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Missing name or email" },
        { status: 400 },
      );
    }

    // Fetch all approved admins and super_admins to notify
    const { data: admins, error: adminsErr } = await supabase
      .from("drivers")
      .select("name, email")
      .in("role", ["admin", "super_admin"])
      .eq("approved", true)
      .eq("refused", false);

    if (adminsErr) {
      console.error(
        "[notify-admins] Failed to fetch admins:",
        adminsErr.message,
      );
      return NextResponse.json({ error: adminsErr.message }, { status: 500 });
    }

    if (!admins || admins.length === 0) {
      // No admins to notify — not an error
      return NextResponse.json({ sent: 0 });
    }

    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin`;

    // Send one email per admin via Resend
    const sends = admins.map((admin) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Kronos Planner <noreply@kronos-simsports.com>",
          to: admin.email,
          subject: `Nouveau pilote en attente — ${name}`,
          html: buildEmail({
            newDriverName: name,
            newDriverEmail: email,
            adminName: admin.name,
            adminUrl,
          }),
        }),
      })
        .then((r) => {
          if (!r.ok) {
            return r
              .text()
              .then((t) =>
                console.error(
                  `[notify-admins] Resend error for ${admin.email}:`,
                  t,
                ),
              );
          }
        })
        .catch((err) =>
          console.error(
            `[notify-admins] Fetch error for ${admin.email}:`,
            err.message,
          ),
        ),
    );

    // Wait for all sends to complete (failures are caught individually above)
    await Promise.allSettled(sends);

    return NextResponse.json({ sent: admins.length });
  } catch (err) {
    console.error("[notify-admins] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Builds a simple styled HTML email for the admin notification
function buildEmail({ newDriverName, newDriverEmail, adminName, adminUrl }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nouveau pilote en attente</title>
</head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Segoe UI',Arial,sans-serif;color:#e8e8e8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f13;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:1.6rem;font-weight:800;letter-spacing:0.06em;color:#e8c84b;">
                KRONOS
              </span>
              <span style="font-size:1.6rem;font-weight:300;letter-spacing:0.06em;color:#e8e8e8;">
                &nbsp;PLANNER
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1a1a22;border:1px solid #2a2a35;border-radius:6px;padding:32px;">

              <!-- Icon + title -->
              <p style="font-size:2rem;margin:0 0 12px;text-align:center;">🏎️</p>
              <h1 style="margin:0 0 8px;font-size:1.2rem;font-weight:700;color:#e8e8e8;text-align:center;">
                Nouveau pilote en attente
              </h1>
              <p style="margin:0 0 24px;font-size:0.85rem;color:#888;text-align:center;">
                Un nouveau pilote vient de s&apos;inscrire et attend votre approbation.
              </p>

              <!-- Driver info -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#0f0f13;border:1px solid #2a2a35;border-radius:4px;margin-bottom:24px;">
                <tr>
                  <td style="padding:10px 16px;border-bottom:1px solid #2a2a35;font-size:0.78rem;
                              color:#888;text-transform:uppercase;letter-spacing:0.08em;">
                    Nom
                  </td>
                  <td style="padding:10px 16px;border-bottom:1px solid #2a2a35;font-size:0.95rem;
                              font-weight:700;color:#e8e8e8;">
                    ${newDriverName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:0.78rem;color:#888;
                              text-transform:uppercase;letter-spacing:0.08em;">
                    Email
                  </td>
                  <td style="padding:10px 16px;font-size:0.85rem;color:#e8e8e8;font-family:monospace;">
                    ${newDriverEmail}
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${adminUrl}"
                      style="display:inline-block;background:#e8c84b;color:#0f0f13;
                             font-weight:800;font-size:0.9rem;letter-spacing:0.06em;
                             text-decoration:none;padding:12px 32px;border-radius:4px;">
                      GÉRER LES PILOTES
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
