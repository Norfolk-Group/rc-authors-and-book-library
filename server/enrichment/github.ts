/**
 * github.ts — GitHub REST API enrichment for author profiles
 *
 * Uses the public GitHub REST API (no auth required for public data).
 * Auth token is optional but increases rate limit from 60 to 5000 req/hr.
 *
 * Data retrieved:
 *   - followers, following, public_repos, public_gists
 *   - bio, blog, company, location, twitter_username
 *   - total stars across all public repos (requires extra call)
 */

const GITHUB_API_BASE = "https://api.github.com";

export interface GitHubStats {
  username: string;
  profileUrl: string;
  followers: number;
  following: number;
  publicRepos: number;
  publicGists: number;
  totalStars: number;
  bio: string | null;
  blog: string | null;
  company: string | null;
  location: string | null;
  twitterUsername: string | null;
  fetchedAt: string;
}

/**
 * Extract GitHub username from a GitHub URL.
 * Handles: https://github.com/username, github.com/username, @username
 */
export function extractGitHubUsername(githubUrl: string): string | null {
  if (!githubUrl) return null;
  const match = githubUrl.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];
  // Handle bare @username or username
  const bare = githubUrl.replace(/^@/, "").trim();
  if (/^[a-zA-Z0-9_-]+$/.test(bare)) return bare;
  return null;
}

/**
 * Fetch GitHub stats for a given username.
 */
export async function fetchGitHubStats(
  githubUrl: string,
  authToken?: string
): Promise<GitHubStats | null> {
  const username = extractGitHubUsername(githubUrl);
  if (!username) return null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "authors-books-library/1.0",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  try {
    // Fetch user profile
    const userRes = await fetch(`${GITHUB_API_BASE}/users/${username}`, {
      headers,
    });
    if (!userRes.ok) {
      console.warn(`[GitHub] User not found: ${username} (${userRes.status})`);
      return null;
    }
    const user = (await userRes.json()) as {
      login: string;
      html_url: string;
      followers: number;
      following: number;
      public_repos: number;
      public_gists: number;
      bio: string | null;
      blog: string | null;
      company: string | null;
      location: string | null;
      twitter_username: string | null;
    };

    // Fetch repos to calculate total stars (up to first 100 repos)
    let totalStars = 0;
    try {
      const reposRes = await fetch(
        `${GITHUB_API_BASE}/users/${username}/repos?per_page=100&sort=stars`,
        { headers }
      );
      if (reposRes.ok) {
        const repos = (await reposRes.json()) as Array<{
          stargazers_count: number;
        }>;
        totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
      }
    } catch {
      // Non-critical — proceed without star count
    }

    return {
      username: user.login,
      profileUrl: user.html_url,
      followers: user.followers,
      following: user.following,
      publicRepos: user.public_repos,
      publicGists: user.public_gists,
      totalStars,
      bio: user.bio,
      blog: user.blog,
      company: user.company,
      location: user.location,
      twitterUsername: user.twitter_username,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[GitHub] Error fetching stats for ${username}:`, err);
    return null;
  }
}
