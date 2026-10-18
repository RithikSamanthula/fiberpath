import { Suspense } from "react";
import StreetPage from "./StreetPage";

export const metadata = { title: "Street view — FiberPath" };

export default function Page() {
  return (
    <Suspense fallback={<main className="wrap page"><p>Loading</p></main>}>
      <StreetPage />
    </Suspense>
  );
}
