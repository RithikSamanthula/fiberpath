import { Suspense } from "react";
import Household from "./Household";

export const metadata = { title: "Your home - FiberPath" };

export default function Page() {
  return (
    <Suspense fallback={<main className="wrap page"><p>Loading</p></main>}>
      <Household />
    </Suspense>
  );
}
