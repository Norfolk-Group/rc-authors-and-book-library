/**
 * AdminFavoritesTab — Admin Console: Favorites section.
 * Wraps FavoritesTab.
 */
import { Star } from "@phosphor-icons/react";
import { FavoritesTab } from "./FavoritesTab";

export function AdminFavoritesTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Star className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
          <p className="text-muted-foreground text-sm">
            Your saved authors and books
          </p>
        </div>
      </div>
      <FavoritesTab />
    </div>
  );
}
