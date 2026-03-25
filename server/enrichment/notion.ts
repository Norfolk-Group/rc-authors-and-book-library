/**
 * Notion Bidirectional Sync — Reading Notes
 *
 * Syncs book library data to a Notion database and pulls reading notes back.
 * Uses the Notion MCP server (configured in the sandbox) for all operations.
 *
 * Features:
 * - Push book profiles to a Notion database (title, author, category, rating, summary)
 * - Pull reading notes, highlights, and annotations back to the app
 * - Track sync status per book
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotionSyncConfig {
  databaseId: string | null;
  lastSyncAt: string | null;
  syncDirection: "push" | "pull" | "bidirectional";
  autoSync: boolean;
}

export interface NotionBookPage {
  pageId: string;
  bookTitle: string;
  authorName: string | null;
  category: string | null;
  rating: number | null;
  status: "to_read" | "reading" | "completed" | "abandoned";
  notes: string | null;
  highlights: string[];
  lastEditedAt: string;
  url: string;
}

export interface NotionSyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
  syncedAt: string;
}

export interface ReadingNote {
  bookTitle: string;
  pageId: string;
  notes: string | null;
  highlights: string[];
  status: "to_read" | "reading" | "completed" | "abandoned";
  rating: number | null;
  startDate: string | null;
  finishDate: string | null;
  lastEditedAt: string;
  notionUrl: string;
}

// ── MCP Execution Helper ──────────────────────────────────────────────────────

import { execSync } from "child_process";

/**
 * Execute a Notion MCP tool call and return the parsed result.
 */
function callNotionMCP(toolName: string, input: Record<string, any>): any {
  try {
    const inputJson = JSON.stringify(input);
    const cmd = `manus-mcp-cli tool call ${toolName} --server notion --input '${inputJson.replace(/'/g, "'\\''")}'`;
    const result = execSync(cmd, {
      timeout: 30000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(result);
  } catch (err: any) {
    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    throw new Error(`Notion MCP error: ${stderr || stdout || err.message}`);
  }
}

// ── Database Operations ───────────────────────────────────────────────────────

/**
 * Create a Notion database for the book library if it doesn't exist.
 * Returns the database ID.
 */
export async function createNotionDatabase(
  parentPageId: string,
): Promise<string> {
  const result = callNotionMCP("create_database", {
    parent_page_id: parentPageId,
    title: "NCG Book Library",
    properties: {
      Title: { title: {} },
      Author: { rich_text: {} },
      Category: {
        select: {
          options: [
            { name: "Strategy", color: "blue" },
            { name: "Psychology", color: "purple" },
            { name: "Sales", color: "green" },
            { name: "Leadership", color: "orange" },
            { name: "Innovation", color: "red" },
            { name: "Communication", color: "yellow" },
            { name: "Culture", color: "pink" },
            { name: "Technology", color: "gray" },
            { name: "Growth", color: "brown" },
          ],
        },
      },
      Rating: { number: { format: "number" } },
      Status: {
        select: {
          options: [
            { name: "To Read", color: "default" },
            { name: "Reading", color: "blue" },
            { name: "Completed", color: "green" },
            { name: "Abandoned", color: "red" },
          ],
        },
      },
      "Key Themes": { rich_text: {} },
      Summary: { rich_text: {} },
    },
  });

  return result?.id || result?.database_id;
}

/**
 * Push a book profile to the Notion database.
 */
export async function pushBookToNotion(
  databaseId: string,
  book: {
    title: string;
    author: string | null;
    category: string | null;
    rating: number | null;
    summary: string | null;
    keyThemes: string | null;
  },
): Promise<string | null> {
  try {
    const properties: Record<string, any> = {
      Title: { title: [{ text: { content: book.title } }] },
    };

    if (book.author) {
      properties.Author = { rich_text: [{ text: { content: book.author } }] };
    }
    if (book.category) {
      properties.Category = { select: { name: book.category } };
    }
    if (book.rating) {
      properties.Rating = { number: book.rating };
    }
    if (book.keyThemes) {
      properties["Key Themes"] = {
        rich_text: [{ text: { content: book.keyThemes.slice(0, 2000) } }],
      };
    }

    const content = book.summary
      ? `## Summary\n\n${book.summary}\n\n---\n\n## My Notes\n\n_Add your reading notes here..._`
      : `## My Notes\n\n_Add your reading notes here..._`;

    const result = callNotionMCP("create_page", {
      database_id: databaseId,
      properties,
      content,
    });

    return result?.id || result?.page_id || null;
  } catch {
    return null;
  }
}

/**
 * Pull reading notes from a Notion page.
 */
export async function pullNotesFromNotion(
  pageId: string,
): Promise<ReadingNote | null> {
  try {
    const page = callNotionMCP("get_page", { page_id: pageId });
    if (!page) return null;

    const blocks = callNotionMCP("get_block_children", {
      block_id: pageId,
    });

    // Extract text content from blocks
    let notes = "";
    const highlights: string[] = [];

    if (blocks?.results) {
      for (const block of blocks.results) {
        if (block.type === "paragraph" && block.paragraph?.rich_text) {
          const text = block.paragraph.rich_text
            .map((t: any) => t.plain_text)
            .join("");
          notes += text + "\n";
        }
        if (block.type === "callout" || block.type === "quote") {
          const richText =
            block[block.type]?.rich_text ||
            block[block.type]?.text;
          if (richText) {
            const text = richText.map((t: any) => t.plain_text).join("");
            highlights.push(text);
          }
        }
        if (block.type === "bulleted_list_item") {
          const text = block.bulleted_list_item?.rich_text
            ?.map((t: any) => t.plain_text)
            .join("");
          if (text) highlights.push(text);
        }
      }
    }

    const props = page.properties || {};
    const titleProp = props.Title?.title?.[0]?.plain_text || "";
    const statusProp = props.Status?.select?.name?.toLowerCase().replace(/ /g, "_") || "to_read";
    const ratingProp = props.Rating?.number || null;

    return {
      bookTitle: titleProp,
      pageId,
      notes: notes.trim() || null,
      highlights,
      status: statusProp as ReadingNote["status"],
      rating: ratingProp,
      startDate: null,
      finishDate: null,
      lastEditedAt: page.last_edited_time || new Date().toISOString(),
      notionUrl: page.url || `https://notion.so/${pageId.replace(/-/g, "")}`,
    };
  } catch {
    return null;
  }
}

/**
 * Search the Notion database for a book by title.
 */
export async function findBookInNotion(
  databaseId: string,
  bookTitle: string,
): Promise<string | null> {
  try {
    const result = callNotionMCP("query_database", {
      database_id: databaseId,
      filter: {
        property: "Title",
        title: { equals: bookTitle },
      },
    });

    return result?.results?.[0]?.id || null;
  } catch {
    return null;
  }
}

/**
 * Sync all books to Notion (push) and pull any notes back.
 */
export async function syncBooksWithNotion(
  databaseId: string,
  books: Array<{
    title: string;
    author: string | null;
    category: string | null;
    rating: number | null;
    summary: string | null;
    keyThemes: string | null;
  }>,
): Promise<NotionSyncResult> {
  const errors: string[] = [];
  let pushed = 0;
  let pulled = 0;

  for (const book of books) {
    try {
      // Check if book already exists in Notion
      const existingPageId = await findBookInNotion(databaseId, book.title);

      if (!existingPageId) {
        // Push new book
        const pageId = await pushBookToNotion(databaseId, book);
        if (pageId) pushed++;
        else errors.push(`Failed to push: ${book.title}`);
      } else {
        // Pull notes from existing page
        const notes = await pullNotesFromNotion(existingPageId);
        if (notes && (notes.notes || notes.highlights.length > 0)) {
          pulled++;
        }
      }
    } catch (err: any) {
      errors.push(`Error syncing ${book.title}: ${err.message}`);
    }
  }

  return {
    pushed,
    pulled,
    errors,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Health check for Notion MCP integration.
 */
export async function checkNotionHealth(): Promise<{
  status: "ok" | "error" | "unconfigured";
  latencyMs: number;
  message: string;
}> {
  const start = Date.now();
  try {
    // Try listing available tools to verify MCP connection
    const result = execSync("manus-mcp-cli tool list --server notion 2>&1", {
      timeout: 15000,
      encoding: "utf-8",
    });
    const latency = Date.now() - start;

    if (result.includes("error") || result.includes("Error")) {
      return { status: "error", latencyMs: latency, message: "Notion MCP server not responding" };
    }

    return { status: "ok", latencyMs: latency, message: "Notion MCP connected" };
  } catch (err: any) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: err.message || "Notion MCP unavailable",
    };
  }
}
