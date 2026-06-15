/**
 * SuperConversationsWriter.tsx
 *
 * Writing studio for "Super Conversations" — a book by Ricardo Cidale.
 * Ricardo orchestrates (direction, ideas, chapter briefs); the ghostwriter
 * agent produces polished non-fiction prose.
 *
 * Route: /write
 *
 * Features:
 *   - Stateful multi-turn session (sessionId threaded across turns)
 *   - Sends/receives via the superConversations.chat tRPC procedure
 *   - Enter to send, Shift+Enter for newline
 *   - New Session button resets the session
 *   - Copy button on each agent reply
 *   - Auto-scroll to the latest message
 */

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  BookOpen,
  ArrowLeft,
  PenLine,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface Message {
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

const STARTER_PROMPTS = [
  "Write the opening paragraph for Chapter 1 — Curiosity and Open-Ended Questions",
  "Draft a vivid sales scene that shows the difference between a scripted pitch and a curiosity-driven discovery call",
  "Outline the seven core principles with a one-sentence description for each",
  "Write the AI Training section for Principle 3: Active Listening",
  "Write a short introduction that frames why most sales conversations fail and what Super Conversations fix",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} group`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground border border-border"
      }`}>
        {isUser ? "RC" : <PenLine size={14} />}
      </div>

      <div className={`max-w-[80%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted border border-border rounded-tl-sm"
        }`}>
          {message.content}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && <CopyButton text={message.content} />}
        </div>
      </div>
    </div>
  );
}

export default function SuperConversationsWriter() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = trpc.superConversations.chat.useMutation({
    onSuccess(data) {
      setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: data.reply, timestamp: new Date() },
      ]);
    },
    onError(err) {
      toast.error(err.message ?? "The ghostwriter encountered an error. Please try again.");
    },
  });

  const isLoading = chatMutation.isPending;

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed, timestamp: new Date() },
    ]);
    setInput("");
    chatMutation.mutate({ message: trimmed, sessionId });
  }, [isLoading, sessionId, chatMutation]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewSession = () => {
    setSessionId(undefined);
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground -ml-2"
            >
              <ArrowLeft size={16} className="mr-1" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-primary" />
              <span className="font-semibold text-foreground">Super Conversations</span>
              <Badge variant="secondary" className="text-xs">Writing Studio</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessionId && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Session active · {messages.length} exchanges
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSession}
              disabled={isLoading}
            >
              <RefreshCw size={14} className="mr-1.5" />
              New Session
            </Button>
          </div>
        </div>

        {/* Book context strip */}
        <div className="px-4 pb-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">by Ricardo Cidale</span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground">B2B Sales Methodology · AI Agent Training</span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground">7 Principles of Super Conversations</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
                <PenLine size={24} className="text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Your ghostwriter is ready</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                You orchestrate — direct the writing, share ideas, request drafts or outlines.
                The ghostwriter writes the prose.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Start with a prompt</p>
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left text-sm px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
              <PenLine size={14} className="text-muted-foreground" />
            </div>
            <div className="bg-muted border border-border rounded-xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                Writing…
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-border bg-card px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Direct the ghostwriter — describe a scene, request a draft, ask for an outline, or say 'what's next'…"
              className="flex-1 min-h-[52px] max-h-48 resize-none rounded-xl text-sm"
              disabled={isLoading}
              rows={2}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="rounded-xl h-[52px] w-[52px] flex-shrink-0 p-0"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Enter to send · Shift+Enter for newline · Sessions persist writing context
          </p>
        </div>
      </div>
    </div>
  );
}
