# AuthorCard Redesign Requirements (User Reference)

> Saved from user paste — keep this in context at all times during the AuthorCard work.

## Goal
Keep all existing functionality (avatar, mini book covers with links, content-type badges,
click handlers, icons, etc.) but significantly improve the visual design using Tailwind +
Flowbite React.

## Tailwind + Flowbite Setup (Tailwind v4 note)
This project uses **Tailwind CSS v4** (CSS-first, no `tailwind.config.js`).
- The Flowbite Vite plugin auto-injects `@import "flowbite-react/plugin/tailwindcss"` and
  `@source ".flowbite-react/class-list.json"` into `client/src/index.css`.
- No `tailwind.config.js` is needed or created.
- `flowbite` and `flowbite-react` are already installed.

## Target Card Shell (from user)

```tsx
import { Card, Badge } from "flowbite-react";

<Card
  className="
    h-full rounded-2xl border border-slate-100 bg-white
    shadow-[0_10px_35px_rgba(15,23,42,0.08)]
    transition duration-200 ease-out
    hover:-translate-y-0.5 hover:scale-[1.01]
    hover:shadow-[0_22px_55px_rgba(15,23,42,0.18)]
  "
>
  {/* Top: category + author + avatar */}
  {/* Middle: bio link */}
  {/* Divider: h-px bg-slate-100 */}
  {/* Bottom: Books count, resource pills (PDF/Transcript/Binder/Supplemental), mini covers */}
</Card>
```

## Resource Pills Style (from user)
- PDF → `bg-rose-50 text-rose-600` dot `bg-rose-400`
- Transcript → `bg-emerald-50 text-emerald-600` dot `bg-emerald-400`
- Binder → `bg-indigo-50 text-indigo-600` dot `bg-indigo-400`
- Supplemental → `bg-amber-50 text-amber-600` dot `bg-amber-400`
- Shape: `rounded-full px-2.5 py-0.5 text-[10px] font-medium`

## Grid Layout (from user)
```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
```

## What Must Be Preserved
- Avatar (AvatarUpload component with zoom-on-hover)
- Mini book cover thumbnails with click handlers (lightbox + Drive link)
- Content-type badges (PDF, Transcript, Binder, Supplemental counts)
- "Bio ready" Badge (flowbite-react `<Badge color="success">`)
- Category icon + colour-coded left border stripe
- Google Drive ExternalLink icon on hover
- Framer Motion 3-D tilt
- onBioClick / onBookClick callbacks
- BookSubfolderRow list
- Search highlight (`<mark className="search-highlight">`)

## Deliverables After Completion
1. Show the final `FlowbiteAuthorCard` implementation
2. Show any Tailwind / Flowbite config changes
