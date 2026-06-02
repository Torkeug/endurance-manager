import { guide } from "./guide.data";
import GuideClient from "./components/GuideClient";
import { getSessionAndDriver, isAdmin } from "../../lib/auth";

export default async function Page() {
  const { driver } = await getSessionAndDriver();
  const admin = isAdmin(driver);
  const filteredGuide = guide.filter((s) => {
    if (s.navTab === "Admin" && !admin) return false;
    if (s.adminOnly && !admin) return false;
    if (s.hideForAdmins && admin) return false;
    return true;
  });
  return <GuideClient guide={filteredGuide} />;
}
