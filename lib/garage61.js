import { supabaseServer as supabase } from "./supabase-server";

export const GARAGE61_API = "https://garage61.net/api/v1";
const CLIENT_ID = "01KSEXK2MP3Q4T2219885XN17V";
const GARAGE61_TOKEN_URL = "https://garage61.net/api/oauth/token";

export async function tryRefreshToken(driverId, storedRefreshToken) {
  if (!storedRefreshToken) return null;
  try {
    const res = await fetch(GARAGE61_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: storedRefreshToken,
        client_id: CLIENT_ID,
        client_secret: process.env.GARAGE61_CLIENT_SECRET,
      }),
    });
    if (!res.ok) return null;
    const { access_token, refresh_token: newRefreshToken } = await res.json();
    if (!access_token) return null;
    await supabase
      .from("drivers")
      .update({
        garage61_access_token: access_token,
        garage61_refresh_token: newRefreshToken ?? storedRefreshToken,
      })
      .eq("id", driverId);
    return access_token;
  } catch {
    return null;
  }
}

export async function g61Fetch(url, token, driverId, refreshToken, fetchOptions = {}) {
  const res = await fetch(url, { ...fetchOptions, headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 && refreshToken) {
    const newToken = await tryRefreshToken(driverId, refreshToken);
    if (!newToken) return { ok: false, status: 401, data: null };
    const retry = await fetch(url, { headers: { Authorization: `Bearer ${newToken}` } });
    return { ok: retry.ok, status: retry.status, data: retry.ok ? await retry.json() : null };
  }
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
}
