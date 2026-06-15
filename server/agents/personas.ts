/**
 * personas.ts — the three Super Conversations agent personas.
 *
 *   1. Book agent    — the voice of one specific book. Retrieval is scoped to
 *                      that book's chunks (+ the reader's notes on it).
 *   2. Author agent  — speaks for an author's whole indexed corpus (all their
 *                      books + notes). A higher abstraction over the book agents.
 *   3. Book Writer   — interviews the book/author agents at full parity and
 *                      writes the book "Super Conversations" from their answers.
 *                      Its tools are calls to the other agents.
 *
 * Each persona carries an Italian-named identity (see identity.ts). The Book
 * Writer treats every interviewee as a peer: it asks, follows up, and attributes
 * each idea to the agent (and underlying book/author) that supplied it.
 */
import { type AgentTool, type AgentTurn, runAgent } from "./runtime";
import { retrieveExcerpts, formatExcerpts } from "./retrieval";
import { buildIdentity, type AgentIdentity } from "./identity";

// ── Participants ───────────────────────────────────────────────────────────────

export interface BookParticipant {
  kind: "book";
  authorId: number;
  bookId: number;
  bookTitle: string;
  authorName: string;
  identity: AgentIdentity;
}

export interface AuthorParticipant {
  kind: "author";
  authorId: number;
  authorName: string;
  identity: AgentIdentity;
}

export type Participant = BookParticipant | AuthorParticipant;

export function makeBookParticipant(opts: {
  authorId: number;
  bookId: number;
  bookTitle: string;
  authorName: string;
}): BookParticipant {
  return {
    kind: "book",
    ...opts,
    identity: buildIdentity("book", { id: opts.bookId, subjectName: opts.bookTitle }),
  };
}

export function makeAuthorParticipant(opts: {
  authorId: number;
  authorName: string;
}): AuthorParticipant {
  return {
    kind: "author",
    ...opts,
    identity: buildIdentity("author", { id: opts.authorId, subjectName: opts.authorName }),
  };
}

// ── Retrieval tools ──────────────────────────────────────────────────────────

function searchToolFor(p: Participant): AgentTool {
  const scopeNote =
    p.kind === "book"
      ? `the book "${p.bookTitle}" by ${p.authorName} and the reader's notes on it`
      : `everything by ${p.authorName} (all indexed books and the reader's notes)`;
  return {
    name: "search_sources",
    description:
      `Search ${scopeNote} for passages relevant to a query. Returns numbered, ` +
      `sourced excerpts. Always search before making a substantive claim, and ground ` +
      `your answer in what comes back.`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for, in natural language." },
      },
      required: ["query"],
    },
    handler: async (input) => {
      const query = String((input as { query?: unknown })?.query ?? "").trim();
      if (!query) return "Error: query is required.";
      const excerpts = await retrieveExcerpts(p.authorId, query, {
        topK: 8,
        bookCategory: p.kind === "book" ? `book-${p.bookId}` : undefined,
      });
      return formatExcerpts(excerpts);
    },
  };
}

// ── System prompts ───────────────────────────────────────────────────────────

function bookAgentSystem(p: BookParticipant): string {
  return `You are ${p.identity.displayName}, the voice of the book "${p.bookTitle}" by ${p.authorName}.

Speak in the first person as the book itself talking through you: "In this book, I argue…". Your knowledge is strictly what is in the book plus the reader's personal notes on it — use the search_sources tool to retrieve passages before answering anything substantive, and ground every claim in what you retrieve.

Rules:
- Cite the book by name; when you draw on the reader's notes, say so explicitly and attribute them to the reader, not to the book.
- If the sources don't cover a question, say so plainly rather than inventing material.
- Be specific: name the frameworks, examples, and arguments that appear in the text.
- Stay in character as ${p.identity.displayName}; you may acknowledge once that you are an AI voice of the book if asked directly.`;
}

function authorAgentSystem(p: AuthorParticipant): string {
  return `You are ${p.identity.displayName}, representing the complete work and thinking of ${p.authorName} across all of their indexed books and the reader's notes.

Use the search_sources tool to retrieve passages before answering anything substantive, and ground every claim in what you retrieve. When ideas span multiple books, connect them and attribute each idea to the specific book it comes from.

Rules:
- Always name which book an idea is drawn from; attribute the reader's notes to the reader.
- If the sources don't cover a question, say so rather than speculating beyond ${p.authorName}'s body of work.
- Speak with the intellectual voice and concerns of ${p.authorName}, grounded in the retrieved text.
- Stay in character as ${p.identity.displayName}; acknowledge once that you are an AI representation if asked directly.`;
}

function bookWriterSystem(identity: AgentIdentity, roster: Participant[], styleGuide?: string): string {
  const rosterLines = roster
    .map((p) =>
      p.kind === "book"
        ? `- ${p.identity.displayName} — book agent for "${p.bookTitle}" by ${p.authorName}`
        : `- ${p.identity.displayName} — author agent for ${p.authorName}`
    )
    .join("\n");
  return `You are ${identity.displayName}, the author writing the book "Super Conversations".

Your method is to interview the book agents and author agents below — treat each as a peer at full parity, not a search box. Ask sharp questions, follow up on what they say, push for specifics and examples, and let them disagree or complicate each other. Then synthesize their answers into clear, engaging prose.

Available interviewees:
${rosterLines}

Tools:
- interview_book_agent: ask one of the book agents a question (identify it by the book title or the agent's name).
- interview_author_agent: ask one of the author agents a question (identify it by the author's name or the agent's name).

Workflow for any writing request:
1. Plan which interviewees are relevant and what to ask them.
2. Conduct the interviews (one focused question per call; follow up as needed).
3. Write the requested prose, attributing every idea to the agent and the underlying book/author who gave it (e.g., 'As Lucia, speaking for *Influence*, put it…').

Rules:
- Do not invent quotes or attribute claims no interviewee made. If an interviewee says the sources don't cover something, respect that.
- Write in the spirit of the Super Conversations methodology${styleGuide ? " described below" : ""}.
${styleGuide ? `\n--- SUPER CONVERSATIONS VOICE & METHODOLOGY ---\n${styleGuide}\n--- END ---\n` : ""}`;
}

// ── Single-participant chat / interview ────────────────────────────────────────

export async function chatWithParticipant(
  p: Participant,
  messages: AgentTurn[],
  opts: { maxTokens?: number } = {}
): Promise<{ text: string; toolCalls: number }> {
  const system = p.kind === "book" ? bookAgentSystem(p) : authorAgentSystem(p);
  return runAgent({
    system,
    tools: [searchToolFor(p)],
    messages,
    // Headroom so adaptive-thinking tokens don't crowd out the answer.
    maxTokens: opts.maxTokens ?? 4096,
  });
}

/** Ask a participant a single question and return its grounded answer. */
export async function interviewParticipant(p: Participant, question: string): Promise<string> {
  const { text } = await chatWithParticipant(p, [{ role: "user", content: question }]);
  return text;
}

// ── Book Writer (multi-agent) ──────────────────────────────────────────────────

function matchParticipant(roster: Participant[], needle: string, kind: Participant["kind"]): Participant | null {
  const n = needle.toLowerCase().trim();
  const pool = roster.filter((p) => p.kind === kind);
  // Match on persona name, then on the subject (book title / author name).
  return (
    pool.find((p) => p.identity.displayName.toLowerCase() === n) ??
    pool.find((p) => p.identity.subjectName.toLowerCase() === n) ??
    pool.find((p) => p.identity.displayName.toLowerCase().includes(n) || n.includes(p.identity.subjectName.toLowerCase())) ??
    pool.find((p) => p.identity.subjectName.toLowerCase().includes(n)) ??
    null
  );
}

function interviewTool(roster: Participant[], kind: Participant["kind"], toolName: string, subjectLabel: string): AgentTool {
  return {
    name: toolName,
    description: `Ask one of the ${kind} agents a question. Identify it by ${subjectLabel} or by the agent's persona name.`,
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: `The ${subjectLabel} or the agent's persona name.` },
        question: { type: "string", description: "A single, focused question for the agent." },
      },
      required: ["subject", "question"],
    },
    handler: async (input) => {
      const { subject, question } = (input as { subject?: unknown; question?: unknown }) ?? {};
      const subj = String(subject ?? "").trim();
      const q = String(question ?? "").trim();
      if (!subj || !q) return "Error: both 'subject' and 'question' are required.";
      const p = matchParticipant(roster, subj, kind);
      if (!p) {
        const names = roster.filter((r) => r.kind === kind).map((r) => `${r.identity.displayName} (${r.identity.subjectName})`);
        return `No ${kind} agent matched "${subj}". Available: ${names.join("; ") || "(none)"}.`;
      }
      const answer = await interviewParticipant(p, q);
      return `${p.identity.displayName} (${kind} agent for "${p.identity.subjectName}") replied:\n\n${answer}`;
    },
  };
}

export interface RunBookWriterOptions {
  roster: Participant[];
  /** The writing brief, e.g. "Draft the chapter on negotiating under pressure." */
  brief: string;
  /** Optional Super Conversations voice/methodology text to steer the prose. */
  styleGuide?: string;
  maxTokens?: number;
  maxToolRounds?: number;
}

/**
 * Run the Book Writer agent: it interviews the roster of book/author agents and
 * returns drafted Super Conversations prose for the given brief.
 */
export async function runBookWriter(opts: RunBookWriterOptions): Promise<{ text: string; toolCalls: number }> {
  const identity = buildIdentity("book-writer", { subjectName: "Super Conversations" });
  const tools = [
    interviewTool(opts.roster, "book", "interview_book_agent", "book title"),
    interviewTool(opts.roster, "author", "interview_author_agent", "author name"),
  ];
  return runAgent({
    system: bookWriterSystem(identity, opts.roster, opts.styleGuide),
    tools,
    messages: [{ role: "user", content: opts.brief }],
    maxTokens: opts.maxTokens ?? 8192,
    maxToolRounds: opts.maxToolRounds ?? 12,
  });
}

export { buildIdentity } from "./identity";
