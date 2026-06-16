/**
 * BookChatbot.tsx
 *
 * Book & Author conversational chatbot — powered by the Opus managed book agent.
 * The agent answers questions about a specific book AND the author's full catalog,
 * grounding every answer via host-side retrieval tools (no hallucination).
 *
 * Route: /book-chat/:slug
 * - slug is the URL-encoded book title
 *
 * Features:
 *   - Book cover + title + author in header
 *   - Opening message seeds the managed-agents session (no split-brain)
 *   - Multi-turn conversation with server-side memory (sessionId threaded)
 *   - Reset clears conversation and starts a fresh session
 *   - Keyboard: Enter to send, Shift+Enter for newline, Esc to go back
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { LazyImage } from "@/components/ui/LazyImage";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Send,
  RefreshCw,
  Loader2,
  BookOpen,
  AlertCircle,
  User,
  MessageSquare,
  Info,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function MessageBubble({ message, coverUrl }: {
  message: Message;
  coverUrl?: string | null;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center">
        {isUser ? (
          <User className="w-4 h-4 text-muted-foreground" />
        ) : coverUrl ? (
          <LazyImage src={coverUrl} alt="book cover" className="w-full h-full object-cover" eager />
        ) : (
          <BookOpen className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border rounded-tl-sm"
        }`}>
          {message.content}
        </div>
        <span className="text-xs text-muted-foreground px-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

export default function BookChatbot() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const bookTitle = decodeURIComponent(slug ?? "");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOpening, setLoadingOpening] = useState(true);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: bookInfo, isLoading: loadingInfo } = trpc.bookChatbot.getBookChatInfo.useQuery(
    { bookTitle },
    { enabled: !!bookTitle }
  );

  const chatMutation = trpc.bookChatbot.chatV2.useMutation();

  // Scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Escape key → go back.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  // Seed the opening message through chatV2 so turn 1 and all subsequent turns
  // share the same managed-agents session — no split-brain.
  const startSession = useCallback(() => {
    setLoadingOpening(true);
    chatMutation.mutateAsync({
      bookTitle,
      message:
        "Please introduce this book and its author — share the central argument and one or two key insights, then invite me to explore further.",
    }).then((result) => {
      if (result.sessionId) setSessionId(result.sessionId);
      setMessages([{
        role: "assistant",
        content: result.reply || `Welcome. I'm here to discuss "${bookTitle}". What would you like to explore?`,
        timestamp: new Date(),
      }]);
    }).catch(() => {
      setMessages([{
        role: "assistant",
        content: `Welcome. I'm here to discuss "${bookTitle}". What would you like to know?`,
        timestamp: new Date(),
      }]);
    }).finally(() => setLoadingOpening(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookTitle]);

  useEffect(() => {
    if (!bookTitle) return;
    startSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookTitle]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: new Date() }]);
    setInput("");
    setSending(true);

    try {
      const result = await chatMutation.mutateAsync({
        bookTitle,
        message: text,
        sessionId,
      });
      if (result.sessionId) setSessionId(result.sessionId);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: result.reply || "I'm unable to respond right now. Please try again.",
        timestamp: new Date(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "I encountered an error. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [input, sending, bookTitle, chatMutation, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setSessionId(undefined);
    startSession();
  };

  if (loadingInfo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bookInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Book not found: {bookTitle}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </div>
    );
  }

  const isReady = bookInfo.isReady;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-8 px-2"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Book identity */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
            {bookInfo.coverUrl ? (
              <LazyImage src={bookInfo.coverUrl} alt={bookTitle} className="w-full h-full object-cover" eager />
            ) : (
              <BookOpen className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-semibold text-sm truncate">{bookTitle}</h1>
              {bookInfo.authorName && (
                <span className="text-xs text-muted-foreground truncate">by {bookInfo.authorName}</span>
              )}
              <Badge
                className={`text-xs px-1.5 py-0 ${isReady ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}
              >
                {isReady ? "Knowledge Active" : "Not Enriched"}
              </Badge>
            </div>
            {bookInfo.publishedDate && (
              <p className="text-xs text-muted-foreground">{bookInfo.publishedDate.slice(0, 4)}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleReset}
          disabled={loadingOpening || sending}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>

      {/* Disclaimer */}
      {isReady && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/30 text-xs text-amber-700 dark:text-amber-400">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          AI knowledge agent grounded in the book's documented content and the author's published works. Not the author.
        </div>
      )}

      {/* Not ready state */}
      {!isReady && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-lg mb-1">Book Not Enriched</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              "{bookTitle}" hasn't been enriched with a summary yet.
              Go to Admin → Books to enrich it first.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
            <Button onClick={() => navigate("/admin")}>
              <BookOpen className="w-4 h-4 mr-2" />
              Open Admin
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      {isReady && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {loadingOpening ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening the conversation…
              </div>
            ) : (
              messages.map((msg, idx) => (
                <MessageBubble
                  key={idx}
                  message={msg}
                  coverUrl={bookInfo.coverUrl}
                />
              ))
            )}

            {sending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  {bookInfo.coverUrl ? (
                    <LazyImage src={bookInfo.coverUrl} alt={bookTitle} className="w-full h-full object-cover rounded-md" eager />
                  ) : (
                    <BookOpen className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t bg-card px-4 py-3">
            <div className="flex gap-2 items-end max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask about "${bookTitle}" or its author…`}
                  className="resize-none min-h-[44px] max-h-[120px] text-sm pr-2 py-2.5"
                  rows={1}
                  disabled={sending || loadingOpening}
                />
              </div>
              <Button
                size="sm"
                className="h-[44px] w-[44px] p-0 flex-shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || sending || loadingOpening}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1.5">
              <MessageSquare className="w-3 h-3 inline mr-1" />
              Enter to send · Shift+Enter for new line · Esc to go back
            </p>
          </div>
        </>
      )}
    </div>
  );
}
