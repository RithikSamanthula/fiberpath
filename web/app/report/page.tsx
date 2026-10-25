import { Suspense } from "react";
import Report from "./Report";

export const metadata = { title: "Grant report - FiberPath" };

export default function Page() {
  return (
    <Suspense fallback={<main className="wrap page"><p>Loading</p></main>}>
      <Report />
    </Suspense>
  );
}
