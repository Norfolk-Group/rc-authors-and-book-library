# Authors & Books Library — Design Brainstorm

## Chosen Approach: Editorial Intelligence

**Design Movement:** Editorial Modernism meets Knowledge Architecture  
**Inspiration:** The visual language of *The Economist*, *Monocle*, and premium academic publishers — where information density is a virtue, not a problem.

**Core Principles:**
1. **Ink & Paper Warmth** — Off-white backgrounds with warm cream tones, dark charcoal text. Feels like a well-curated library, not a tech dashboard.
2. **Typographic Hierarchy** — Display serif (Playfair Display) for headings, clean sans-serif (DM Sans) for body. The contrast between the two creates instant visual rhythm.
3. **Category as Color** — Each of the 9 categories gets a distinct, muted accent color. Cards are white but carry a thin left-border stripe in the category color.
4. **Asymmetric Grid** — A persistent left sidebar for navigation/filtering, a wide right content area with a masonry-style card grid. Not centered — anchored left.

**Color Philosophy:**
- Background: `oklch(0.97 0.01 80)` — warm off-white, like aged paper
- Foreground: `oklch(0.18 0.01 60)` — deep charcoal, not pure black
- Category accent palette: 9 distinct muted tones (terracotta, slate blue, forest green, amber, plum, teal, rust, navy, sage)
- Primary action: Deep navy `oklch(0.28 0.08 250)`

**Layout Paradigm:**
- Fixed left sidebar (260px) with logo, search bar, category filters, and stats
- Right content area: tabbed between Authors and Books, with a masonry card grid
- Hero strip at top: library stats (99 authors, 65 books, 9 categories) in a horizontal band

**Signature Elements:**
1. Category color-coded left border on every card
2. Subtle grid paper texture on the sidebar background
3. Search with instant live filtering — no submit button needed

**Interaction Philosophy:**
- Search filters in real-time as you type
- Category chips are toggleable — click to filter, click again to deselect
- Cards have a gentle lift shadow on hover
- Smooth fade-in for filtered results

**Animation:**
- Cards fade + slide up on initial load (staggered, 50ms delay per card)
- Filter transitions: cards that don't match fade out and collapse, matching ones remain
- Sidebar category counts update with a number flip animation

**Typography System:**
- Display: Playfair Display (700) — headings, section titles
- Body: DM Sans (400, 500) — all body text, labels, metadata
- Mono: JetBrains Mono — category tags, counts

---

<response><text>Approach A: Dark Academia — Deep forest green and aged gold on near-black backgrounds, with serif fonts and candlelight warmth.</text><probability>0.07</probability></response>
<response><text>Approach B: Editorial Modernism — Off-white paper tones, typographic hierarchy, category-coded color borders, asymmetric sidebar layout.</text><probability>0.09</probability></response>
<response><text>Approach C: Brutalist Catalog — Raw grid, stark black borders, monospace typography, zero decoration — pure information architecture.</text><probability>0.05</probability></response>
