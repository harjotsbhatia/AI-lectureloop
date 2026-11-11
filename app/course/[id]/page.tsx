import { Suspense } from "react";
import CourseOverview from "@/components/CourseOverview";
import { PageMessage } from "@/components/Chrome";

export default function Page() {
  return (
    <Suspense fallback={<PageMessage>Loading course…</PageMessage>}>
      <CourseOverview />
    </Suspense>
  );
}
