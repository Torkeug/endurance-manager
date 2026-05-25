import { supabaseServer as supabase } from "./supabase-server";

export const GARAGE61_API = "https://garage61.net/api/v1";
const CLIENT_ID = "01KSEXK2MP3Q4T2219885XN17V";
const GARAGE61_TOKEN_URL = "https://garage61.net/api/oauth/token";

// Module-level cache for Garage61 responses that exceed Next.js's 2MB fetch
// cache limit (e.g. /statistics at ~4.4MB). Keyed by URL for team/global
// endpoints; keyed by driverId:url for /me which is user-specific.
const _cache = new Map();

function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { _cache.delete(key); return null; }
  return entry.data;
}

function setCached(key, data, ttlSeconds) {
  _cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

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
  const ttl = fetchOptions?.next?.revalidate;
  // /me is user-specific — scope cache to driver; all other endpoints are team/global
  const cacheKey = url.includes("/me") ? `${driverId}:${url}` : url;

  if (ttl) {
    const cached = getCached(cacheKey);
    if (cached !== null) return { ok: true, status: 200, data: cached };
  }

  const res = await fetch(url, { ...fetchOptions, headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 && refreshToken) {
    const newToken = await tryRefreshToken(driverId, refreshToken);
    if (!newToken) return { ok: false, status: 401, data: null };
    const retry = await fetch(url, { headers: { Authorization: `Bearer ${newToken}` } });
    const retryData = retry.ok ? await retry.json() : null;
    if (ttl && retry.ok) setCached(cacheKey, retryData, ttl);
    return { ok: retry.ok, status: retry.status, data: retryData };
  }

  const data = res.ok ? await res.json() : null;
  if (ttl && res.ok) setCached(cacheKey, data, ttl);
  return { ok: res.ok, status: res.status, data };
}
