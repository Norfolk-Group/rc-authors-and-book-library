/**
 * SuperConversations.tsx
 *
 * Browse and talk to the Super Conversations agents:
 *   - Author agents (whole-corpus) and Book agents (one book), each with an
 *     Italian persona name + avatar.
 *   - Chat panel grounded in the indexed books + reader's notes.
 *   - Book Writer (admin only): pick a roster of agents and draft a section of
 *     "Super Conversations" by interviewing them.
 *
 * Route: /conversations
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LazyImage } from "@/components/ui/LazyImage";
import { LottieLoader } from "@/components/LottieLoader";
import {
  ArrowLeft,
  Send,
  Loader2,
  BookOpen,
  Users,
  PenLine,
  MessageSquare,
  Sparkles,
} from "lucide-react";

type AgentKind = "book" | "author";

interface AgentRef {
  kind: AgentKind;
  id: number; // bookId for books, authorId for authors
  displayName: string;
  subjectName: string;
  avatarUrl: string | null;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ url, name, sizeClass }: { url: string | null; name: string; sizeClass: string }) {
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-ncg-teal/10 text-ncg-teal flex items-center justify-center flex-shrink-0 font-semibold`}>
      {url ? (
        <LazyImage src={url} alt={name} className="w-full h-full object-cover" eager />
      ) : (
        <span className="text-xs">{monogram(name)}</span>
      )}
    </div>
  );
}

export default function SuperConversations() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"chat" | "writer">("chat");
  const [selected, setSelected] = useState<AgentRef | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks the live selection so an in-flight reply can be discarded if the
  // user has since switched agents (otherwise it lands in the wrong thread).
  const selectedRef = useRef<AgentRef | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const { data: me } = trpc.auth.me.useQuery();
  const isAdmin = me?.role === "admin";
  const { data: agents, isLoading } = trpc.superConversations.listAgents.useQuery();

  const chatBook = trpc.superConversations.chatBookAgent.useMutation();
  const chatAuthor = trpc.superConversations.chatAuthorAgent.useMutation();
  const sending = chatBook.isPending || chatAuthor.isPending;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const selectAgent = useCallback((a: AgentRef) => {
    setSelected(a);
    setMessages([]);
    setInput("");
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !selected || sending) return;
    const requestAgent = selected;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    // Only append the reply if the user is still on the agent we asked.
    const appendIfCurrent = (content: string) =>
      setMessages((prev) => {
        const active = selectedRef.current;
        if (!active || active.kind !== requestAgent.kind || active.id !== requestAgent.id) return prev;
        return [...prev, { role: "assistant" as const, content }];
      });
    try {
      const res =
        requestAgent.kind === "book"
          ? await chatBook.mutateAsync({ bookId: requestAgent.id, messages: next })
          : await chatAuthor.mutateAsync({ authorId: requestAgent.id, messages: next });
      const reply = res.success && res.reply ? res.reply : (res as { message?: string }).message ?? "No response.";
      appendIfCurrent(reply);
    } catch {
      appendIfCurrent("Something went wrong. Please try again.");
    }
  }, [input, selected, sending, messages, chatBook, chatAuthor]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shadow-sm">
        <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
          <h1 className="font-semibold text-sm truncate">Super Conversations</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant={mode === "chat" ? "default" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setMode("chat")}>
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat</span>
          </Button>
          {isAdmin && (
            <Button variant={mode === "writer" ? "default" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setMode("writer")}>
              <PenLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Book Writer</span>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <LottieLoader label="Loading agents…" />
        </div>
      ) : !agents || (agents.authors.length === 0 && agents.books.length === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <Users className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm max-w-sm">
            No agents yet. Index an author's books with the Super Conversations pipeline, then they'll appear here.
          </p>
        </div>
      ) : mode === "writer" && isAdmin ? (
        <BookWriterPanel agents={agents} />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Roster */}
          <aside className="w-72 border-r overflow-y-auto bg-card/40 flex-shrink-0 hidden md:block">
            <RosterList agents={agents} selected={selected} onSelect={selectAgent} />
          </aside>

          {/* Chat */}
          <main className="flex-1 flex flex-col min-w-0">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <MessageSquare className="w-10 h-10" />
                <p className="text-sm">Pick an agent to start a conversation.</p>
                <div className="md:hidden w-full max-w-sm">
                  <RosterList agents={agents} selected={selected} onSelect={selectAgent} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-card">
                  <Avatar url={selected.avatarUrl} name={selected.displayName} sizeClass="w-9 h-9" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-sm truncate">{selected.displayName}</h2>
                      <Badge className="text-xs px-1.5 py-0 bg-primary/10 text-primary border-0">
                        {selected.kind === "book" ? "Book agent" : "Author agent"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {selected.kind === "book" ? `voice of “${selected.subjectName}”` : `speaking for ${selected.subjectName}`}
                    </p>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Ask {selected.displayName} about {selected.kind === "book" ? "this book's ideas" : `${selected.subjectName}'s work`}.
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      {m.role === "assistant" && <Avatar url={selected.avatarUrl} name={selected.displayName} sizeClass="w-8 h-8" />}
                      <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex gap-3">
                      <Avatar url={selected.avatarUrl} name={selected.displayName} sizeClass="w-8 h-8" />
                      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t bg-card px-4 py-3">
                  <div className="flex gap-2 items-end max-w-4xl mx-auto">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={`Ask ${selected.displayName}…`}
                      className="resize-none min-h-[44px] max-h-[120px] text-sm py-2.5"
                      rows={1}
                      disabled={sending}
                    />
                    <Button size="sm" className="h-[44px] w-[44px] p-0 flex-shrink-0" onClick={handleSend} disabled={!input.trim() || sending}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

interface AgentsData {
  authors: Array<{ authorId: number; key: string; displayName: string; gender: string; avatarUrl: string | null; subjectName: string; vectorCount: number }>;
  books: Array<{ bookId: number; authorId: number; key: string; displayName: string; gender: string; avatarUrl: string | null; subjectName: string }>;
}

function RosterList({ agents, selected, onSelect }: {
  agents: AgentsData;
  selected: AgentRef | null;
  onSelect: (a: AgentRef) => void;
}) {
  const row = (a: AgentRef) => {
    const isSel = selected?.kind === a.kind && selected?.id === a.id;
    return (
      <button
        key={`${a.kind}-${a.id}`}
        onClick={() => onSelect(a)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-md transition-colors ${isSel ? "bg-primary/10" : "hover:bg-muted"}`}
      >
        <Avatar url={a.avatarUrl} name={a.displayName} sizeClass="w-8 h-8" />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{a.displayName}</div>
          <div className="text-xs text-muted-foreground truncate">{a.subjectName}</div>
        </div>
      </button>
    );
  };
  return (
    <div className="p-2 space-y-4">
      <div>
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Users className="w-3.5 h-3.5" /> Authors
        </div>
        <div className="space-y-0.5">
          {agents.authors.map((a) => row({ kind: "author", id: a.authorId, displayName: a.displayName, subjectName: a.subjectName, avatarUrl: a.avatarUrl }))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <BookOpen className="w-3.5 h-3.5" /> Books
        </div>
        <div className="space-y-0.5">
          {agents.books.map((b) => row({ kind: "book", id: b.bookId, displayName: b.displayName, subjectName: b.subjectName, avatarUrl: b.avatarUrl }))}
        </div>
      </div>
    </div>
  );
}

function BookWriterPanel({ agents }: { agents: AgentsData }) {
  const [brief, setBrief] = useState("");
  const [bookIds, setBookIds] = useState<Set<number>>(new Set());
  const [authorIds, setAuthorIds] = useState<Set<number>>(new Set());
  const writeSection = trpc.superConversations.writeSection.useMutation();

  const toggle = (set: Set<number>, setFn: (s: Set<number>) => void, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  };

  const canDraft = brief.trim().length > 0 && (bookIds.size > 0 || authorIds.size > 0) && !writeSection.isPending;

  const result = writeSection.data;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" /> Book Writer
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose interviewees and a brief. The Book Writer interviews each agent and drafts a section of <em>Super Conversations</em>.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Author agents</div>
            <div className="flex flex-wrap gap-1.5">
              {agents.authors.map((a) => (
                <Button key={a.authorId} size="sm" variant={authorIds.has(a.authorId) ? "default" : "outline"} className="h-7 text-xs"
                  onClick={() => toggle(authorIds, setAuthorIds, a.authorId)}>
                  {a.displayName}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Book agents</div>
            <div className="flex flex-wrap gap-1.5">
              {agents.books.map((b) => (
                <Button key={b.bookId} size="sm" variant={bookIds.has(b.bookId) ? "default" : "outline"} className="h-7 text-xs"
                  onClick={() => toggle(bookIds, setBookIds, b.bookId)}>
                  {b.displayName}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. Draft the chapter on negotiating under pressure, contrasting how each interviewee approaches it."
          className="min-h-[100px] text-sm"
        />

        <Button
          disabled={!canDraft}
          onClick={() => writeSection.mutate({ brief: brief.trim(), bookIds: Array.from(bookIds), authorIds: Array.from(authorIds) })}
        >
          {writeSection.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PenLine className="w-4 h-4 mr-2" />}
          {writeSection.isPending ? "Interviewing & drafting…" : "Draft section"}
        </Button>

        {writeSection.isPending && (
          <p className="text-xs text-muted-foreground">This fans out into many interviews — it can take a couple of minutes.</p>
        )}

        {result && (
          result.success && result.draft ? (
            <div className="rounded-md border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-2">
                {result.interviews} interview turn{result.interviews === 1 ? "" : "s"} · {result.roster.map((r) => r.displayName).join(", ")}
              </div>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">{result.draft}</div>
            </div>
          ) : (
            <p className="text-sm text-destructive">{(result as { message?: string }).message ?? "Drafting failed."}</p>
          )
        )}
      </div>
    </div>
  );
}
