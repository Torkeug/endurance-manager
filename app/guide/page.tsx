import { guide } from "./guide.data";
import GuideClient from "./components/GuideClient";
import { getSessionAndDriver, isAdmin } from "../../lib/auth";

export default async function Page() {
  const { driver } = await getSessionAndDriver();
  const admin = isAdmin(driver);
  const filteredGuide = admin ? guide : guide.filter((s) => s.navTab !== "Admin");
  return <GuideClient guide={filteredGuide} />;
}
