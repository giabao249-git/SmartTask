import { Suspense } from "react";
import { SettingsNotificationsView } from "@/features/settings/SettingsNotificationsView";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsNotificationsView />
    </Suspense>
  );
}
