import type { Metadata } from "next";
import CareRelayApp from "@/components/CareRelayApp";

export const metadata: Metadata = {
  title: "Amina · CareRelay EarlySignal (synthetic demo)",
};

// Every patient id renders the single synthetic demo case (backend slug "amina", patient DEMO-001).
export default function Patient360Page() {
  return <CareRelayApp />;
}
