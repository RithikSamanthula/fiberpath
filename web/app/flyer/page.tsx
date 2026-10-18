import { Suspense } from "react";
import Flyer from "./Flyer";

export const metadata = { title: "Flyer - FiberPath" };

export default function Page() {
  return (
    <Suspense fallback={<main className="wrap page"><p>Loading</p></main>}>
      <Flyer />
    </Suspense>
  );
}
