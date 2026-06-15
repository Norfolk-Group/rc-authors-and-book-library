/**
 * AdminSuperConversationsTab — Manage which authors and books belong to
 * the "superconversations" conversation group (the SC Writer knowledge base).
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChatCircleText,
  UserCircle,
  Books,
  Plus,
  Trash,
  MagnifyingGlass,
} from "@phosphor-icons/react";

const GROUP = "superconversations";

// ── Authors panel ──────────────────────────────────────────────────────────────

function AuthorsPanel() {
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: members = [], isLoading: loadingMembers } =
    trpc.authorProfiles.listByGroup.useQuery({ group: GROUP });

  const { data: allAuthorsRaw = [] } =
    trpc.authorProfiles.getAllEnrichedNames.useQuery(undefined, { staleTime: 60_000 });

  const setGroupsMutation = trpc.authorProfiles.setConversationGroups.useMutation({
    onSuccess: () => utils.authorProfiles.listByGroup.invalidate({ group: GROUP }),
  });

  const memberNames = useMemo(() => new Set(members.map((a) => a.authorName)), [members]);

  const nonMembers = useMemo(() => {
    const q = search.toLowerCase();
    return (allAuthorsRaw as string[])
      .filter((name) => !memberNames.has(name))
      .filter((name) => !q || name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allAuthorsRaw, memberNames, search]);

  async function addAuthor(authorName: string) {
    await setGroupsMutation.mutateAsync({ authorName, groups: [GROUP] });
    toast.success(`Added ${authorName}`);
  }

  async function removeAuthor(authorName: string) {
    await setGroupsMutation.mutateAsync({ authorName, groups: [] });
    toast.success(`Removed ${authorName}`);
  }

  return (
    <div className="space-y-4">
      {/* Current members */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold">In Group</h3>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
        {loadingMembers ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No authors in this group yet.</p>
        ) : (
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
            {members.map((a) => (
              <div
                key={a.authorName}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {a.s3AvatarUrl ? (
                    <img src={a.s3AvatarUrl} className="w-6 h-6 rounded-full object-cover flex-shrink-0" alt="" />
                  ) : (
                    <UserCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-sm truncate">{a.authorName}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAuthor(a.authorName)}
                  disabled={setGroupsMutation.isPending}
                >
                  <Trash className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add authors */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Add Author</h3>
        <div className="relative mb-2">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search authors…"
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
          {nonMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">No matches</p>
          ) : (
            nonMembers.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-muted/40 group"
              >
                <span className="text-sm">{name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-primary"
                  onClick={() => addAuthor(name)}
                  disabled={setGroupsMutation.isPending}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Books panel ────────────────────────────────────────────────────────────────

function BooksPanel() {
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: members = [], isLoading: loadingMembers } =
    trpc.bookProfiles.listByGroup.useQuery({ group: GROUP });

  const { data: allBooksRaw = [] } =
    trpc.bookProfiles.getAllEnrichedTitles.useQuery(undefined, { staleTime: 60_000 });

  const setGroupsMutation = trpc.bookProfiles.setConversationGroups.useMutation({
    onSuccess: () => utils.bookProfiles.listByGroup.invalidate({ group: GROUP }),
  });

  const memberTitles = useMemo(() => new Set(members.map((b) => b.bookTitle)), [members]);

  const nonMembers = useMemo(() => {
    const q = search.toLowerCase();
    return (allBooksRaw as string[])
      .filter((t) => !memberTitles.has(t))
      .filter((t) => !q || t.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allBooksRaw, memberTitles, search]);

  async function addBook(bookTitle: string) {
    await setGroupsMutation.mutateAsync({ bookTitle, groups: [GROUP] });
    toast.success(`Added "${bookTitle}"`);
  }

  async function removeBook(bookTitle: string) {
    await setGroupsMutation.mutateAsync({ bookTitle, groups: [] });
    toast.success(`Removed "${bookTitle}"`);
  }

  return (
    <div className="space-y-4">
      {/* Current members */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold">In Group</h3>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
        {loadingMembers ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No books in this group yet.</p>
        ) : (
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
            {members.map((b) => (
              <div
                key={b.bookTitle}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {b.s3CoverUrl ? (
                    <img src={b.s3CoverUrl} className="w-5 h-7 rounded object-cover flex-shrink-0" alt="" />
                  ) : (
                    <Books className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm truncate">{b.bookTitle}</p>
                    {b.authorName && (
                      <p className="text-[10px] text-muted-foreground truncate">{b.authorName}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeBook(b.bookTitle)}
                  disabled={setGroupsMutation.isPending}
                >
                  <Trash className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add books */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Add Book</h3>
        <div className="relative mb-2">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search books…"
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
          {nonMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">No matches</p>
          ) : (
            nonMembers.map((title) => (
              <div
                key={title}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-muted/40 group"
              >
                <span className="text-sm truncate">{title}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-primary"
                  onClick={() => addBook(title)}
                  disabled={setGroupsMutation.isPending}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────

export function AdminSuperConversationsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <ChatCircleText className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Super Conversations</h1>
          <p className="text-muted-foreground text-sm">
            Manage the authors and books available to the SC Writer agent for interviews and research.
          </p>
        </div>
      </div>

      <Tabs defaultValue="authors">
        <TabsList>
          <TabsTrigger value="authors" className="gap-1.5">
            <UserCircle className="w-3.5 h-3.5" />
            Authors
          </TabsTrigger>
          <TabsTrigger value="books" className="gap-1.5">
            <Books className="w-3.5 h-3.5" />
            Books
          </TabsTrigger>
        </TabsList>
        <TabsContent value="authors" className="mt-4">
          <AuthorsPanel />
        </TabsContent>
        <TabsContent value="books" className="mt-4">
          <BooksPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
