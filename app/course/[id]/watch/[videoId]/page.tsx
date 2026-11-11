import { Suspense } from "react";
import Classroom from "@/components/Classroom";
import { PageMessage } from "@/components/Chrome";

export default function Page() {
  return (
    <Suspense fallback={<PageMessage>Loading lesson…</PageMessage>}>
      <Classroom />
    </Suspense>
  );
}
