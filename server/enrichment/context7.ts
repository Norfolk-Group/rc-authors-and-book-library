/**
 * Context7 / Technical References Enrichment
 *
 * Fetches relevant documentation, code examples, and framework references
 * for technical books. Uses the Context7 MCP server when available,
 * with fallback to GitHub API and DevDocs for code documentation.
 *
 * Features:
 * - Search for code documentation referenced in technical books
 * - Find GitHub repositories related to book topics
 * - Surface API docs and framework references
 * - Link to official documentation for technologies mentioned in books
 */
import { AXIOS_TIMEOUT_MS } from "@shared/const";
import { execSync } from "child_process";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CodeReference {
  title: string;
  url: string;
  type: "documentation" | "repository" | "tutorial" | "api_reference" | "example";
  language: string | null;
  framework: string | null;
  description: string;
  stars: number | null; // GitHub stars if applicable
  source: "context7" | "github" | "devdocs" | "manual";
}

export interface TechnicalReferencesResult {
  bookTitle: string;
  references: CodeReference[];
  technologies: string[];
  frameworks: string[];
  languages: string[];
  totalReferences: number;
  fetchedAt: string;
  source: "context7" | "github" | "combined";
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "NCGLibrary/1.0",
        Accept: "application/json",
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Technology Detection ──────────────────────────────────────────────────────

/**
 * Known technical topics and their associated technologies/frameworks.
 * Used to detect relevant references for a book.
 */
const TECH_KEYWORDS: Record<string, { languages: string[]; frameworks: string[]; searchTerms: string[] }> = {
  "machine learning": {
    languages: ["Python"],
    frameworks: ["TensorFlow", "PyTorch", "scikit-learn"],
    searchTerms: ["machine learning tutorial", "deep learning framework"],
  },
  "artificial intelligence": {
    languages: ["Python"],
    frameworks: ["OpenAI", "LangChain", "Hugging Face"],
    searchTerms: ["AI programming", "neural networks"],
  },
  "data science": {
    languages: ["Python", "R"],
    frameworks: ["pandas", "NumPy", "Jupyter"],
    searchTerms: ["data analysis", "statistical computing"],
  },
  "web development": {
    languages: ["JavaScript", "TypeScript"],
    frameworks: ["React", "Node.js", "Next.js"],
    searchTerms: ["web framework", "frontend development"],
  },
  "software engineering": {
    languages: ["Java", "Python", "Go"],
    frameworks: ["Spring", "Django", "Docker"],
    searchTerms: ["software design patterns", "clean code"],
  },
  "cloud computing": {
    languages: ["Python", "Go"],
    frameworks: ["AWS", "Azure", "GCP", "Kubernetes"],
    searchTerms: ["cloud architecture", "infrastructure as code"],
  },
  "cybersecurity": {
    languages: ["Python", "C"],
    frameworks: ["OWASP", "Metasploit", "Wireshark"],
    searchTerms: ["security tools", "penetration testing"],
  },
  "blockchain": {
    languages: ["Solidity", "Rust"],
    frameworks: ["Ethereum", "Hardhat", "Web3.js"],
    searchTerms: ["smart contracts", "decentralized applications"],
  },
  "devops": {
    languages: ["YAML", "Python", "Bash"],
    frameworks: ["Docker", "Kubernetes", "Terraform", "Ansible"],
    searchTerms: ["CI/CD pipeline", "infrastructure automation"],
  },
  "algorithms": {
    languages: ["Python", "Java", "C++"],
    frameworks: [],
    searchTerms: ["algorithm implementation", "data structures"],
  },
};

/**
 * Detect technologies mentioned in a book's title, summary, and key themes.
 */
export function detectTechnologies(
  bookTitle: string,
  summary: string | null,
  keyThemes: string | null,
): { languages: string[]; frameworks: string[]; searchTerms: string[] } {
  const text = `${bookTitle} ${summary || ""} ${keyThemes || ""}`.toLowerCase();

  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const searchTerms = new Set<string>();

  for (const [keyword, tech] of Object.entries(TECH_KEYWORDS)) {
    if (text.includes(keyword)) {
      tech.languages.forEach((l) => languages.add(l));
      tech.frameworks.forEach((f) => frameworks.add(f));
      tech.searchTerms.forEach((t) => searchTerms.add(t));
    }
  }

  // Direct technology mentions
  const directTech: Record<string, { lang: string; fw: string }> = {
    python: { lang: "Python", fw: "" },
    javascript: { lang: "JavaScript", fw: "" },
    typescript: { lang: "TypeScript", fw: "" },
    react: { lang: "JavaScript", fw: "React" },
    "node.js": { lang: "JavaScript", fw: "Node.js" },
    docker: { lang: "", fw: "Docker" },
    kubernetes: { lang: "", fw: "Kubernetes" },
    aws: { lang: "", fw: "AWS" },
    tensorflow: { lang: "Python", fw: "TensorFlow" },
    pytorch: { lang: "Python", fw: "PyTorch" },
  };

  for (const [term, { lang, fw }] of Object.entries(directTech)) {
    if (text.includes(term)) {
      if (lang) languages.add(lang);
      if (fw) frameworks.add(fw);
    }
  }

  return {
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    searchTerms: Array.from(searchTerms),
  };
}

// ── GitHub API ────────────────────────────────────────────────────────────────

/**
 * Search GitHub repositories related to a book's topics.
 * Uses the public GitHub search API (no auth required, rate limited).
 */
export async function searchGitHubRepos(
  query: string,
  maxResults = 5,
): Promise<CodeReference[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=${maxResults}`;

    const data = await fetchJson(url);
    if (!data?.items?.length) return [];

    return data.items.map((repo: any) => ({
      title: repo.full_name,
      url: repo.html_url,
      type: "repository" as const,
      language: repo.language || null,
      framework: null,
      description: repo.description?.slice(0, 200) || "No description",
      stars: repo.stargazers_count || 0,
      source: "github" as const,
    }));
  } catch {
    return [];
  }
}

// ── Context7 MCP ──────────────────────────────────────────────────────────────

/**
 * Search Context7 for documentation references.
 * Uses the Context7 MCP server if available.
 */
export async function searchContext7(
  query: string,
): Promise<CodeReference[]> {
  try {
    const inputJson = JSON.stringify({ query });
    const cmd = `manus-mcp-cli tool call search --server context7 --input '${inputJson.replace(/'/g, "'\\''")}'`;
    const result = execSync(cmd, {
      timeout: 15000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const parsed = JSON.parse(result);
    if (!parsed?.results?.length) return [];

    return parsed.results.map((r: any) => ({
      title: r.title || r.name || "Documentation",
      url: r.url || r.link || "",
      type: "documentation" as const,
      language: r.language || null,
      framework: r.framework || null,
      description: r.description || r.snippet || "",
      stars: null,
      source: "context7" as const,
    }));
  } catch {
    // Context7 MCP not available — this is expected
    return [];
  }
}

// ── Combined Enrichment ───────────────────────────────────────────────────────

/**
 * Enrich a book with technical references from all available sources.
 */
export async function enrichTechnicalReferences(
  bookTitle: string,
  summary: string | null = null,
  keyThemes: string | null = null,
): Promise<TechnicalReferencesResult> {
  const detected = detectTechnologies(bookTitle, summary, keyThemes);

  if (detected.languages.length === 0 && detected.frameworks.length === 0) {
    // Not a technical book — return empty result
    return {
      bookTitle,
      references: [],
      technologies: [],
      frameworks: [],
      languages: [],
      totalReferences: 0,
      fetchedAt: new Date().toISOString(),
      source: "combined",
    };
  }

  // Build search queries
  const queries = [
    `${bookTitle} programming tutorial`,
    ...detected.searchTerms.slice(0, 2),
    ...detected.frameworks.slice(0, 2).map((f) => `${f} documentation`),
  ];

  // Run all searches in parallel
  const results = await Promise.all([
    ...queries.slice(0, 3).map((q) => searchGitHubRepos(q, 3)),
    ...queries.slice(0, 2).map((q) => searchContext7(q)),
  ]);

  // Flatten and deduplicate
  const allRefs = results.flat();
  const seen = new Set<string>();
  const dedupedRefs = allRefs.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Sort by stars (repos first, then docs)
  dedupedRefs.sort((a, b) => (b.stars || 0) - (a.stars || 0));

  return {
    bookTitle,
    references: dedupedRefs.slice(0, 15),
    technologies: [...detected.languages, ...detected.frameworks],
    frameworks: detected.frameworks,
    languages: detected.languages,
    totalReferences: dedupedRefs.length,
    fetchedAt: new Date().toISOString(),
    source: dedupedRefs.some((r) => r.source === "context7") ? "combined" : "github",
  };
}

/**
 * Health check for Context7 / GitHub services.
 */
export async function checkContext7Health(): Promise<{
  github: { status: "ok" | "error"; latencyMs: number };
  context7: { status: "ok" | "unconfigured" | "error"; latencyMs: number };
}> {
  // GitHub health check
  const ghStart = Date.now();
  let ghStatus: "ok" | "error" = "error";
  try {
    const res = await fetch("https://api.github.com/rate_limit", {
      headers: { "User-Agent": "NCGLibrary/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) ghStatus = "ok";
  } catch {}
  const ghLatency = Date.now() - ghStart;

  // Context7 MCP health check
  const c7Start = Date.now();
  let c7Status: "ok" | "unconfigured" | "error" = "unconfigured";
  try {
    const result = execSync("manus-mcp-cli tool list --server context7 2>&1", {
      timeout: 10000,
      encoding: "utf-8",
    });
    if (result && !result.includes("error")) {
      c7Status = "ok";
    }
  } catch {
    c7Status = "unconfigured";
  }
  const c7Latency = Date.now() - c7Start;

  return {
    github: { status: ghStatus, latencyMs: ghLatency },
    context7: { status: c7Status, latencyMs: c7Latency },
  };
}
