import { Tag } from "lucide-react";

interface TagGroupHeaderProps {
  tagName: string;
  tagColor?: string;
  count: number;
}

/** Sticky section divider shown between tag groups when "Group by Tag" sort is active */
export function TagGroupHeader({ tagName, tagColor, count }: TagGroupHeaderProps) {
  const color = tagColor ?? "#6b7280";
  return (
    <div className="col-span-full flex items-center gap-3 mt-6 mb-1 first:mt-0">
      <div
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
        style={{
          backgroundColor: `${color}18`,
          borderColor: `${color}60`,
          color,
        }}
      >
        <Tag className="w-3 h-3" />
        {tagName}
      </div>
      <span className="text-xs text-muted-foreground">{count} {count === 1 ? "item" : "items"}</span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

/** Groups a sorted array by the first tag slug of each item */
export function groupByFirstTag<T>(
  items: T[],
  getFirstTagSlug: (item: T) => string | null,
  allTags: Array<{ slug: string; name: string; color?: string | null }>
): Array<{ tagSlug: string | null; tagName: string; tagColor: string | undefined; items: T[] }> {
  const groups: Map<string, { tagSlug: string | null; tagName: string; tagColor: string | undefined; items: T[] }> = new Map();

  for (const item of items) {
    const slug = getFirstTagSlug(item) ?? "__untagged__";
    if (!groups.has(slug)) {
      const tag = allTags.find((t) => t.slug === slug);
      groups.set(slug, {
        tagSlug: slug === "__untagged__" ? null : slug,
        tagName: tag?.name ?? (slug === "__untagged__" ? "Untagged" : slug),
        tagColor: tag?.color ?? undefined,
        items: [],
      });
    }
    groups.get(slug)!.items.push(item);
  }

  return Array.from(groups.values());
}
