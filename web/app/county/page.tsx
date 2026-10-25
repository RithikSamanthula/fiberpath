import { Suspense } from "react";
import CountyEntry from "./CountyEntry";

export const metadata = { title: "County plans - FiberPath" };

export default function Page() {
  return (
    <Suspense fallback={<main className="wrap page"><p>Loading</p></main>}>
      <CountyEntry />
    </Suspense>
  );
}
