import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const VALID_LOCALES = ["fr", "en"];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("KRONOS_LOCALE")?.value ?? "fr";
  const locale = VALID_LOCALES.includes(raw) ? raw : "fr";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
