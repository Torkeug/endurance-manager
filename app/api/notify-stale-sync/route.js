import { NextResponse } from "next/server";

// POST /api/notify-stale-sync
// Sends a staleness warning email to a driver whose iRacing data hasn't been
// synced via syncOneDriver in over 100 days. Called from syncall in iracing route.
// Always returns 200 — email failure must not block the sync flow.
export async function POST(req) {
  try {
    const { driver_name, driver_email, profile_url } = await req.json();
    if (!driver_name || !driver_email) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Kronos Planner <noreply@kronos-simsports.com>",
        to: driver_email,
        subject: "Vos données iRacing n'ont pas été synchronisées récemment",
        html: buildEmail({ name: driver_name, profileUrl: profile_url }),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[notify-stale-sync] Resend error:", text);
      return NextResponse.json({ success: false, reason: "email_failed" });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify-stale-sync] Unexpected error:", err.message);
    return NextResponse.json({ success: false, reason: "unexpected_error" });
  }
}

function buildEmail({ name, profileUrl }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Synchronisation iRacing</title>
</head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Segoe UI',Arial,sans-serif;color:#e8e8e8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f13;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:1.6rem;font-weight:800;letter-spacing:0.06em;color:#e8c84b;">KRONOS</span>
              <span style="font-size:1.6rem;font-weight:300;letter-spacing:0.06em;color:#e8e8e8;">&nbsp;PLANNER</span>
            </td>
          </tr>
          <tr>
            <td style="background:#1a1a22;border:1px solid #2a2a35;border-radius:6px;padding:32px;">
              <p style="font-size:2rem;margin:0 0 12px;text-align:center;">⚠️</p>
              <h1 style="margin:0 0 8px;font-size:1.2rem;font-weight:700;color:#e8e8e8;text-align:center;">
                Synchronisation iRacing en retard
              </h1>
              <p style="margin:0 0 24px;font-size:0.9rem;color:#aaa;text-align:center;line-height:1.6;">
                Bonjour ${name},<br/><br/>
                Vos données iRacing (inventaire voitures &amp; circuits) n&apos;ont pas été
                synchronisées depuis plus de 100 jours.<br/>
                Pensez à effectuer une synchronisation depuis votre profil.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${profileUrl}"
                      style="display:inline-block;background:#e8c84b;color:#0f0f13;
                             font-weight:800;font-size:0.9rem;letter-spacing:0.06em;
                             text-decoration:none;padding:12px 32px;border-radius:4px;">
                      MON PROFIL →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
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
