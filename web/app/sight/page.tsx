import { Suspense } from "react";
import Sight from "./Sight";

export const metadata = { title: "Line of sight — FiberPath" };

export default function Page() {
  return (
    <Suspense fallback={<main className="wrap page"><p>Loading</p></main>}>
      <Sight />
    </Suspense>
  );
}
