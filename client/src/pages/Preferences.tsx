/**
 * Preferences Page
 * Four tabs: Themes | Icons | Storage | About
 * Uses AppSettingsContext for persistent theme + icon set selection.
 * Storage tab gives power users access to S3 mirror controls.
 */

import { useState, useCallback } from "react";
import { useAppSettings, type ThemeName, type IconSetId } from "@/contexts/AppSettingsContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BooksIcon,
  UsersIcon,
  HeadphonesIcon,
  MagnifyingGlassIcon,
  GearIcon,
  BookOpenIcon,
  CheckIcon,
  HardDrivesIcon,
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ImageIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";

// ── Theme definitions ─────────────────────────────────────────────────────────

const THEMES: {
  id: ThemeName;
  label: string;
  description: string;
  palette: { bg: string; fg: string; primary: string; accent: string; sidebar: string };
}[] = [
  {
    id: "manus",
    label: "Manus",
    description: "Indigo-blue primary, warm off-white surface, deep indigo sidebar. Modern and focused.",
    palette: {
      bg: "#F4F6FA",
      fg: "#1A2340",
      primary: "#4F6EF7",
      accent: "#7C3AED",
      sidebar: "#1A2340",
    },
  },
  {
    id: "norfolk-ai",
    label: "Norfolk AI",
    description: "NCG brand: deep navy sidebar, yellow accent. Bold and institutional.",
    palette: {
      bg: "#F5F8FA",
      fg: "#34475B",
      primary: "#112548",
      accent: "#FDB817",
      sidebar: "#112548",
    },
  },
  {
    id: "noir-dark",
    label: "Noir Dark",
    description: "Executive monochrome: white background, black typography and buttons.",
    palette: {
      bg: "#FFFFFF",
      fg: "#0A0A0A",
      primary: "#0A0A0A",
      accent: "#374151",
      sidebar: "#FFFFFF",
    },
  },
];

// ── Icon set definitions ──────────────────────────────────────────────────────

const ICON_SETS: {
  id: IconSetId;
  label: string;
  description: string;
  weight: "regular" | "duotone";
}[] = [
  {
    id: "phosphor-regular",
    label: "Phosphor Regular",
    description: "1.5px stroke, rounded caps. Matches the Manus icon style exactly.",
    weight: "regular",
  },
  {
    id: "phosphor-duotone",
    label: "Phosphor Duotone",
    description: "Two-tone fill style. Richer on dark themes and executive palettes.",
    weight: "duotone",
  },
];

// Preview icons for the icon set selector
const PREVIEW_ICON_COMPONENTS = [
  BooksIcon,
  UsersIcon,
  HeadphonesIcon,
  MagnifyingGlassIcon,
  GearIcon,
  BookOpenIcon,
];

// ── Color swatch ──────────────────────────────────────────────────────────────

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-6 h-6 rounded border border-border/50 shadow-sm"
        style={{ backgroundColor: color }}
        title={`${label}: ${color}`}
      />
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Theme card ────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: (typeof THEMES)[0];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`p-4 cursor-pointer transition-all border-2 ${
        selected
          ? "border-foreground shadow-md"
          : "border-border hover:border-muted-foreground"
      }`}
      onClick={onSelect}
    >
      {/* Preview strip */}
      <div
        className="w-full h-10 rounded-md mb-3 overflow-hidden flex"
        style={{ backgroundColor: theme.palette.bg }}
      >
        {/* Sidebar strip */}
        <div className="w-8 h-full" style={{ backgroundColor: theme.palette.sidebar }} />
        {/* Content area */}
        <div className="flex-1 flex flex-col justify-center gap-1 px-2">
          <div className="h-1.5 rounded-full w-3/4" style={{ backgroundColor: theme.palette.fg + "30" }} />
          <div className="h-1.5 rounded-full w-1/2" style={{ backgroundColor: theme.palette.accent + "60" }} />
        </div>
        {/* Primary button preview */}
        <div
          className="m-1.5 px-2 rounded flex items-center"
          style={{ backgroundColor: theme.palette.primary, minWidth: 20 }}
        />
      </div>

      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-semibold font-display text-foreground">{theme.label}</span>
          {selected && (
            <span className="ml-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active</span>
          )}
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
            <CheckIcon size={12} className="text-background" weight="bold" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">{theme.description}</p>

      {/* Color palette swatches */}
      <div className="flex gap-2">
        <ColorSwatch color={theme.palette.bg} label="BG" />
        <ColorSwatch color={theme.palette.fg} label="FG" />
        <ColorSwatch color={theme.palette.primary} label="Primary" />
        <ColorSwatch color={theme.palette.accent} label="Accent" />
        <ColorSwatch color={theme.palette.sidebar} label="Sidebar" />
      </div>
    </Card>
  );
}

// ── Icon set card ─────────────────────────────────────────────────────────────

function IconSetCard({
  iconSet,
  selected,
  onSelect,
}: {
  iconSet: (typeof ICON_SETS)[0];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`p-4 cursor-pointer transition-all border-2 ${
        selected
          ? "border-foreground shadow-md"
          : "border-border hover:border-muted-foreground"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold font-display text-foreground">{iconSet.label}</span>
            {selected && (
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{iconSet.description}</p>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
            <CheckIcon size={12} className="text-background" weight="bold" />
          </div>
        )}
      </div>

      {/* Live icon preview row */}
      <div className="flex items-center gap-3 text-foreground mt-3 p-2 bg-muted/40 rounded-md">
        {PREVIEW_ICON_COMPONENTS.map((Icon, i) => (
          <Icon key={i} size={20} weight={iconSet.weight} />
        ))}
      </div>
    </Card>
  );
}

// ── Storage mirror card ───────────────────────────────────────────────────────

type MirrorJobStatus = "idle" | "running" | "done" | "error";

function MirrorCard({
  title,
  description,
  icon: Icon,
  stats,
  onRun,
  status,
  done,
  total,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  stats: { withCover?: number; mirrored?: number; pending?: number; withPhoto?: number } | undefined;
  onRun: () => void;
  status: MirrorJobStatus;
  done: number;
  total: number;
}) {
  const pending = stats?.pending ?? null;
  const mirrored = stats?.mirrored ?? null;
  const allDone = pending === 0;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-0.5">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        {mirrored !== null && (
          <span className="flex items-center gap-1">
            <CheckCircleIcon size={13} className="text-green-500" />
            {mirrored} on S3
          </span>
        )}
        {pending !== null && pending > 0 && (
          <span className="flex items-center gap-1">
            <WarningCircleIcon size={13} className="text-amber-500" />
            {pending} pending
          </span>
        )}
        {allDone && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircleIcon size={13} />
            All images on S3
          </span>
        )}
      </div>

      {/* Progress bar (while running) */}
      {status === "running" && total > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Mirroring {done} of {total}…</span>
            <span>{Math.round((done / total) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.round((done / total) * 100)}%`, backgroundColor: "var(--primary)" }}
            />
          </div>
        </div>
      )}

      <button
        onClick={onRun}
        disabled={status === "running" || allDone}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "running" ? (
          <ArrowsClockwiseIcon size={14} className="animate-spin" />
        ) : status === "done" || allDone ? (
          <CheckCircleIcon size={14} className="text-green-600" />
        ) : (
          <ArrowsClockwiseIcon size={14} />
        )}
        {status === "running"
          ? `Mirroring… ${done} done`
          : status === "done"
          ? "Mirror complete"
          : allDone
          ? "All images on S3 ✓"
          : `Run Mirror${pending !== null ? ` (${pending} pending)` : ""}`}
      </button>
    </Card>
  );
}

// ── Storage tab ───────────────────────────────────────────────────────────────

function StorageTab() {
  const [coverStatus, setCoverStatus] = useState<MirrorJobStatus>("idle");
  const [coverDone, setCoverDone] = useState(0);
  const [coverTotal, setCoverTotal] = useState(0);
  const [photoStatus, setPhotoStatus] = useState<MirrorJobStatus>("idle");
  const [photoDone, setPhotoDone] = useState(0);
  const [photoTotal, setPhotoTotal] = useState(0);

  const mirrorCoversMutation = trpc.bookProfiles.mirrorCovers.useMutation();
  const mirrorPhotosMutation = trpc.authorProfiles.mirrorPhotos.useMutation();
  const coverStats = trpc.bookProfiles.getMirrorCoverStats.useQuery(undefined, { staleTime: 30_000 });
  const photoStats = trpc.authorProfiles.getMirrorPhotoStats.useQuery(undefined, { staleTime: 30_000 });

  const runMirrorCovers = useCallback(async () => {
    if (coverStatus === "running") return;
    const total = coverStats.data?.pending ?? 0;
    if (total === 0) return;
    setCoverStatus("running");
    setCoverDone(0);
    setCoverTotal(total);
    let done = 0;
    try {
      while (true) {
        const result = await mirrorCoversMutation.mutateAsync({ batchSize: 10 });
        done += result.mirrored;
        setCoverDone(done);
        if (result.total === 0 || result.mirrored === 0) break;
      }
      setCoverStatus("done");
      void coverStats.refetch();
      toast.success(`Mirrored ${done} book covers to S3 CDN.`);
    } catch {
      setCoverStatus("error");
      toast.error("Cover mirroring failed. Check the console for details.");
    }
  }, [coverStatus, mirrorCoversMutation, coverStats]);

  const runMirrorPhotos = useCallback(async () => {
    if (photoStatus === "running") return;
    const total = photoStats.data?.pending ?? 0;
    if (total === 0) return;
    setPhotoStatus("running");
    setPhotoDone(0);
    setPhotoTotal(total);
    let done = 0;
    try {
      while (true) {
        const result = await mirrorPhotosMutation.mutateAsync({ batchSize: 10 });
        done += result.mirrored;
        setPhotoDone(done);
        if (result.total === 0 || result.mirrored === 0) break;
      }
      setPhotoStatus("done");
      void photoStats.refetch();
      toast.success(`Mirrored ${done} author photos to S3 CDN.`);
    } catch {
      setPhotoStatus("error");
      toast.error("Photo mirroring failed. Check the console for details.");
    }
  }, [photoStatus, mirrorPhotosMutation, photoStats]);

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">
          S3 CDN Mirror
        </p>
        <p className="text-xs text-muted-foreground">
          Book covers and author photos are fetched from external sources (Amazon, Wikipedia) and mirrored
          to the Manus S3 CDN for reliable, fast delivery. Mirroring runs automatically after enrichment.
          Use these controls to force a manual sync if images appear broken or missing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MirrorCard
          title="Book Covers"
          description="Mirror book cover images from Amazon and Google Books to the S3 CDN."
          icon={ImageIcon}
          stats={coverStats.data}
          onRun={runMirrorCovers}
          status={coverStatus}
          done={coverDone}
          total={coverTotal}
        />
        <MirrorCard
          title="Author Photos"
          description="Mirror author headshots from Wikipedia and publisher sites to the S3 CDN."
          icon={UserCircleIcon}
          stats={photoStats.data}
          onRun={runMirrorPhotos}
          status={photoStatus}
          done={photoDone}
          total={photoTotal}
        />
      </div>

      <p className="text-xs text-muted-foreground pt-1">
        Mirrored images are served from the Manus CDN and will not be affected by third-party rate limits or hotlink blocks.
        Original source URLs are preserved in the database as a fallback.
      </p>
    </div>
  );
}

// ── Main Preferences page ─────────────────────────────────────────────────────

export default function Preferences() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Preferences" }]} />
      <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-display text-foreground mb-1">Preferences</h1>
        <p className="text-sm text-muted-foreground">
          Customize the appearance and behaviour of the NCG Knowledge Library.
        </p>
      </div>

      <Tabs defaultValue="themes">
        <TabsList className="mb-6">
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="icons">Icons</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        {/* ── Themes tab ── */}
        <TabsContent value="themes" className="space-y-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Select Theme
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {THEMES.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                selected={settings.theme === theme.id}
                onSelect={() => updateSettings({ theme: theme.id })}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Theme changes apply instantly and are saved to your browser.
          </p>
        </TabsContent>

        {/* ── Icons tab ── */}
        <TabsContent value="icons" className="space-y-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Icon Style
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ICON_SETS.map((iconSet) => (
              <IconSetCard
                key={iconSet.id}
                iconSet={iconSet}
                selected={settings.iconSet === iconSet.id}
                onSelect={() => updateSettings({ iconSet: iconSet.id })}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Icon style changes apply to navigation and UI icons throughout the app.
          </p>
        </TabsContent>

        {/* ── Storage tab ── */}
        <TabsContent value="storage">
          <StorageTab />
        </TabsContent>

        {/* ── About tab ── */}
        <TabsContent value="about">
          <Card className="p-6">
            <h2 className="text-base font-semibold font-display text-foreground mb-4">About</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Application</span>
                <span className="text-foreground font-medium">NCG Knowledge Library</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Organisation</span>
                <span className="text-foreground font-medium">Norfolk Consulting Group</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Powered by</span>
                <span className="text-foreground font-medium">Norfolk AI</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Icon Library</span>
                <span className="text-foreground font-medium">Phosphor Icons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground font-medium">March 2026</span>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
