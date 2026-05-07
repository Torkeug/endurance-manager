import { guide } from "./guide.data";
import GuideClient from "./components/GuideClient";

export default function Page() {
  return <GuideClient guide={guide} />;
}
