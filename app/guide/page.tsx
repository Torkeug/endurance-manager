import { getTranslations } from "next-intl/server";
import { getGuide } from "./guide.data";
import GuideClient from "./components/GuideClient";
import { getSessionAndDriver, isAdmin } from "../../lib/auth";

export default async function Page() {
  const { driver } = await getSessionAndDriver();
  const admin = isAdmin(driver);
  const t = await getTranslations("guide");
  const guide = getGuide(t as any);
  const filteredGuide = guide.filter((s) => {
    if (s.navTab === "admin" && !admin) return false;
    if (s.adminOnly && !admin) return false;
    if (s.hideForAdmins && admin) return false;
    return true;
  });
  return <GuideClient guide={filteredGuide} />;
}
