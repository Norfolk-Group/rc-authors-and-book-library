/**
 * AdminInterestsTab — Admin Console: My Interests section.
 * Wraps MyInterestsTab.
 */
import { Heart } from "@phosphor-icons/react";
import { MyInterestsTab } from "./MyInterestsTab";

export function AdminInterestsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Heart className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Interests</h1>
          <p className="text-muted-foreground text-sm">
            Manage your reading interests and preferences
          </p>
        </div>
      </div>
      <MyInterestsTab />
    </div>
  );
}
