/**
 * FilterPopover — A popover panel with category toggle switches.
 * Replaces the per-category sidebar list with a single "Filter" button
 * that opens a responsive 2–3 column grid of toggle switches.
 */
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
} from "@/lib/libraryData";
import { ICON_MAP } from "@/components/library/libraryConstants";
import { Briefcase, type LucideIcon } from "lucide-react";

interface FilterPopoverProps {
  selectedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  clearCategoryFilters: () => void;
  /** Counts per category for the active tab */
  categoryCounts: Record<string, number>;
}

export function FilterPopover({
  selectedCategories,
  toggleCategory,
  clearCategoryFilters,
  categoryCounts,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const activeCount = selectedCategories.size;

  const handleSelectAll = () => {
    CATEGORIES.forEach((cat) => {
      if (!selectedCategories.has(cat) && (categoryCounts[cat] ?? 0) > 0) {
        toggleCategory(cat);
      }
    });
  };

  const handleClearAll = () => {
    clearCategoryFilters();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs relative transition-all hover:shadow-md active:scale-95"
        >
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filter</span>
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-4 min-w-4 px-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] sm:w-[420px] p-0"
        align="start"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Filter by Category</span>
            {activeCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {activeCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSelectAll}
              className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
            >
              All
            </button>
            <span className="text-muted-foreground/40">|</span>
            <button
              onClick={handleClearAll}
              className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
            >
              None
            </button>
          </div>
        </div>

        {/* Category grid */}
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-1">
          {CATEGORIES.map((cat) => {
            const color = CATEGORY_COLORS[cat] ?? "hsl(var(--muted-foreground))";
            const iconName = CATEGORY_ICONS[cat] ?? "briefcase";
            const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;
            const count = categoryCounts[cat] ?? 0;
            const isActive = selectedCategories.has(cat);

            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                  isActive
                    ? "bg-accent/80 ring-1 ring-accent-foreground/10"
                    : "hover:bg-muted/60"
                }`}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{
                    backgroundColor: isActive ? color + "20" : "hsl(var(--muted))",
                  }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: isActive ? color : "hsl(var(--muted-foreground))" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {cat}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">{count}</p>
                </div>
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                    isActive ? "bg-current" : "bg-transparent"
                  }`}
                  style={{ color: isActive ? color : undefined }}
                />
              </button>
            );
          })}
        </div>

        {/* Footer with clear */}
        {activeCount > 0 && (
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {activeCount} categor{activeCount === 1 ? "y" : "ies"} selected
            </span>
            <button
              onClick={() => { handleClearAll(); setOpen(false); }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
