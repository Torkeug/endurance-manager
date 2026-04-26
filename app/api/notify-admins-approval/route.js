import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "../../../lib/supabase-server";

// POST /api/notify-admins-approval
// Notifies all approved admins (except the one who performed the approval)
// when a pending driver has been approved. Prevents admins from acting on
// stale pending lists when a colleague already approved the same driver.
// Always returns 200 — email failure must not block the approval action.
export async function POST(req) {
  try {
    const { driver_name, approved_by_name, approved_by_id } = await req.json();
    if (!driver_name || !approved_by_name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Fetch all approved admins except the one who performed the approval
    const { data: admins, error: adminsErr } = await supabase
      .from("drivers")
      .select("name, email")
      .in("role", ["admin", "super_admin"])
      .eq("approved", true)
      .eq("refused", false)
      .neq("id", approved_by_id); // don't notify the approving admin

    if (adminsErr) {
      console.error(
        "[notify-admins-approval] Fetch failed:",
        adminsErr.message,
      );
      return NextResponse.json({ success: false });
    }

    if (!admins || admins.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin`;

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
          subject: `Pilote approuvé — ${driver_name}`,
          html: buildEmail({
            adminName: admin.name,
            driverName: driver_name,
            approvedByName: approved_by_name,
            adminUrl,
          }),
        }),
      })
        .then((r) => {
          if (!r.ok)
            r.text().then((t) =>
              console.error(
                `[notify-admins-approval] Resend error for ${admin.email}:`,
                t,
              ),
            );
        })
        .catch((err) =>
          console.error(
            `[notify-admins-approval] Fetch error for ${admin.email}:`,
            err.message,
          ),
        ),
    );

    await Promise.allSettled(sends);
    return NextResponse.json({ sent: admins.length });
  } catch (err) {
    console.error("[notify-admins-approval] Unexpected error:", err.message);
    return NextResponse.json({ success: false });
  }
}

function buildEmail({ adminName, driverName, approvedByName, adminUrl }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pilote approuvé</title>
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
              <p style="font-size:2rem;margin:0 0 12px;text-align:center;">✅</p>
              <h1 style="margin:0 0 8px;font-size:1.2rem;font-weight:700;color:#e8e8e8;text-align:center;">
                Pilote approuvé
              </h1>
              <p style="margin:0 0 24px;font-size:0.9rem;color:#aaa;text-align:center;line-height:1.6;">
                Bonjour ${adminName},<br/><br/>
                Le pilote <strong style="color:#e8e8e8;">${driverName}</strong>
                a été approuvé par <strong style="color:#e8c84b;">${approvedByName}</strong>.
              </p>
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
