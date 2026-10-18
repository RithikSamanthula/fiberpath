import { Suspense } from "react";
import Poles from "./Poles";

export const metadata = { title: "Poles — FiberPath" };

export default function Page() {
  return (
    <Suspense fallback={<main className="wrap page"><p>Loading</p></main>}>
      <Poles />
    </Suspense>
  );
}
