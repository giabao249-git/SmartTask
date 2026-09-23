import { Suspense } from "react";
import { PeopleView } from "@/features/people/PeopleView";

export default function PeoplePage() {
  return (
    <Suspense>
      <PeopleView />
    </Suspense>
  );
}
