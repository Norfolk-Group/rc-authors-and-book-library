/**
 * identity.ts — Super Conversations agent identities.
 *
 * Every agent in the Super Conversations system is a *persona*, not a faceless
 * endpoint: it is given a male or female Italian name and (once generated) a
 * photorealistic avatar in the same style as the library's author avatars. This
 * lets the reader address "Lucia" or "Marco" rather than "the agent for book 42".
 *
 * The name and gender are derived deterministically from the agent's stable key
 * via a hash, so a given book/author always maps to the same persona across runs
 * and deploys — no persistence required. Avatar URLs come from the committed
 * registry in agentAvatars.ts (populated by the offline generation job).
 *
 * Agent keys:
 *   "book-<bookId>"     — a Book agent (speaks as one specific book)
 *   "author-<authorId>" — an Author agent (speaks for the author's whole corpus)
 *   "book-writer"       — the single Book Writer agent (interviews the others)
 */
import { AGENT_AVATARS } from "./agentAvatars";

export type AgentKind = "book" | "author" | "book-writer";
export type AgentGender = "male" | "female";

export interface AgentIdentity {
  /** Stable key used for retrieval routing and the avatar registry. */
  key: string;
  kind: AgentKind;
  /** Italian persona name, e.g. "Lucia Moretti". */
  displayName: string;
  gender: AgentGender;
  /** Public avatar URL, or null until one has been generated. */
  avatarUrl: string | null;
  /** The real author/book this persona represents (for the UI subtitle). */
  subjectName: string;
}

// Italian first names — kept gender-separated so the persona's name matches its
// (randomly but deterministically assigned) gender.
// SYNC: scripts/generate-agent-avatars.cjs mirrors MALE_NAMES, FEMALE_NAMES,
// SURNAMES and the hash below (it's CommonJS and can't import this module). If
// you change either, change both — the script must derive the same persona.
const MALE_NAMES = [
  "Leonardo", "Marco", "Matteo", "Lorenzo", "Alessandro", "Francesco", "Giovanni",
  "Riccardo", "Stefano", "Davide", "Andrea", "Luca", "Giulio", "Pietro", "Tommaso",
  "Federico", "Antonio", "Vincenzo", "Emanuele", "Salvatore", "Niccolò", "Gabriele",
];
const FEMALE_NAMES = [
  "Sofia", "Giulia", "Aurora", "Alessia", "Chiara", "Francesca", "Martina", "Sara",
  "Valentina", "Elena", "Bianca", "Lucia", "Giorgia", "Beatrice", "Camilla", "Ludovica",
  "Alice", "Greta", "Eleonora", "Federica", "Isabella", "Marta",
];
const SURNAMES = [
  "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci",
  "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa",
  "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro",
  "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone",
];

// FNV-1a 32-bit — small, stable, dependency-free.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function agentKey(kind: AgentKind, id?: number): string {
  return kind === "book-writer" ? "book-writer" : `${kind}-${id}`;
}

/**
 * Build the deterministic persona identity for an agent. `subjectName` is the
 * real author or book title the persona fronts for.
 */
export function buildIdentity(
  kind: AgentKind,
  opts: { id?: number; subjectName: string }
): AgentIdentity {
  const key = agentKey(kind, opts.id);
  const h = hash(key);
  const gender: AgentGender = (h & 1) === 0 ? "female" : "male";
  const firsts = gender === "female" ? FEMALE_NAMES : MALE_NAMES;
  const first = firsts[(h >>> 1) % firsts.length];
  const last = SURNAMES[(h >>> 9) % SURNAMES.length];
  return {
    key,
    kind,
    gender,
    displayName: `${first} ${last}`,
    avatarUrl: AGENT_AVATARS[key] ?? null,
    subjectName: opts.subjectName,
  };
}
