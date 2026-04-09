/**
 * AdminAliasesTab — Admin Console: Author Alias Management section.
 *
 * Allows admins to:
 *  - Browse all author aliases with search
 *  - Add a new alias (rawName → canonical)
 *  - Edit an existing alias
 *  - Delete an alias
 *
 * Backed by trpc.authorAliases.* procedures.
 */
import { useState, useMemo } from "react";
import { ArrowsClockwise, Plus, PencilSimple, Trash, MagnifyingGlass, Tag } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AliasRow {
  id: number;
  rawName: string;
  canonical: string;
  note: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface EditState {
  id?: number;
  rawName: string;
  canonical: string;
  note: string;
}

const EMPTY_EDIT: EditState = { rawName: "", canonical: "", note: "" };

// ── Component ─────────────────────────────────────────────────────────────────
export function AdminAliasesTab() {
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editState, setEditState] = useState<EditState>(EMPTY_EDIT);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = trpc.authorAliases.getAll.useQuery(
    { search: search.trim() || undefined, limit: 500 },
    { staleTime: 30_000 }
  );

  const aliases: AliasRow[] = useMemo(() => data?.aliases ?? [], [data]);
  const total = data?.total ?? 0;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const upsertMutation = trpc.authorAliases.upsert.useMutation({
    onSuccess: (result) => {
      toast.success(result.action === "created" ? "Alias created" : "Alias updated");
      setEditOpen(false);
      setEditState(EMPTY_EDIT);
      void utils.authorAliases.getAll.invalidate();
      void utils.authorAliases.getMap.invalidate();
    },
    onError: (e) => toast.error("Save failed: " + e.message),
  });

  const deleteMutation = trpc.authorAliases.delete.useMutation({
    onSuccess: () => {
      toast.success("Alias deleted");
      setDeleteId(null);
      void utils.authorAliases.getAll.invalidate();
      void utils.authorAliases.getMap.invalidate();
    },
    onError: (e) => toast.error("Delete failed: " + e.message),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function openCreate() {
    setEditState(EMPTY_EDIT);
    setEditOpen(true);
  }

  function openEdit(alias: AliasRow) {
    setEditState({ id: alias.id, rawName: alias.rawName, canonical: alias.canonical, note: alias.note ?? "" });
    setEditOpen(true);
  }

  function handleSave() {
    if (!editState.rawName.trim() || !editState.canonical.trim()) {
      toast.error("Raw name and canonical name are required");
      return;
    }
    upsertMutation.mutate({
      id: editState.id,
      rawName: editState.rawName.trim(),
      canonical: editState.canonical.trim(),
      note: editState.note.trim() || undefined,
    });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Tag className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Author Aliases</h1>
          <p className="text-muted-foreground text-sm">
            Map raw folder names to canonical author display names
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {total} aliases
        </Badge>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <ArrowsClockwise className="h-4 w-4 mr-1.5" weight="bold" />
          Refresh
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" weight="bold" />
          Add Alias
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search raw or canonical name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Raw Name (folder)</TableHead>
              <TableHead>Canonical Name (display)</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Loading aliases…
                </TableCell>
              </TableRow>
            ) : aliases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  {search ? "No aliases match your search." : "No aliases found."}
                </TableCell>
              </TableRow>
            ) : (
              aliases.map((alias, idx) => (
                <TableRow key={alias.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[240px] truncate" title={alias.rawName}>
                    {alias.rawName}
                  </TableCell>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate" title={alias.canonical}>
                    {alias.canonical}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={alias.note ?? ""}>
                    {alias.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Edit alias"
                        onClick={() => openEdit(alias)}
                      >
                        <PencilSimple className="h-3.5 w-3.5" weight="bold" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete alias"
                        onClick={() => setDeleteId(alias.id)}
                      >
                        <Trash className="h-3.5 w-3.5" weight="bold" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) { setEditOpen(false); setEditState(EMPTY_EDIT); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editState.id ? "Edit Alias" : "Add New Alias"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Raw Name <span className="text-destructive">*</span></label>
              <Input
                placeholder="e.g. Adam Grant - Organizational Psychology"
                value={editState.rawName}
                onChange={(e) => setEditState((s) => ({ ...s, rawName: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">The exact folder name as it appears in the source data.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Canonical Name <span className="text-destructive">*</span></label>
              <Input
                placeholder="e.g. Adam Grant"
                value={editState.canonical}
                onChange={(e) => setEditState((s) => ({ ...s, canonical: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">The clean display name shown in the UI.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note</label>
              <Input
                placeholder="Optional note about this alias"
                value={editState.note}
                onChange={(e) => setEditState((s) => ({ ...s, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditState(EMPTY_EDIT); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Alias</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete this alias? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && handleDelete(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
