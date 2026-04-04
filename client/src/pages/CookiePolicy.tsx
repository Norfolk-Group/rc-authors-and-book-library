/**
 * CookiePolicy.tsx
 *
 * Public-facing Cookie Policy page for the NCG Library application.
 * Accessible at /cookies — no authentication required.
 * Linked from the sidebar footer alongside Privacy Policy and Terms of Service.
 */

import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "April 4, 2026";
const CONTACT_EMAIL = "privacy@cidale.com";
const APP_NAME = "NCG Library";
const COMPANY_NAME = "Cidale Consulting Group";
const COMPANY_WEBSITE = "https://cidale.com";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </button>
          </Link>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm font-medium">{APP_NAME} — Cookie Policy</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        {/* Title block */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Cookie Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="1. What Are Cookies?">
          <p>
            Cookies are small text files placed on your device by a website when you visit it. They
            are widely used to make websites work more efficiently, remember your preferences, and
            provide information to the site operators. Cookies can be "session cookies" (deleted when
            you close your browser) or "persistent cookies" (which remain on your device for a set
            period or until you delete them).
          </p>
        </Section>

        <Section title="2. How We Use Cookies">
          <p>
            {APP_NAME} takes a minimal approach to cookies. We use only the cookies that are strictly
            necessary to operate the Service. We do not use advertising cookies, tracking pixels, or
            any third-party analytics cookies that follow you across the web.
          </p>
        </Section>

        <Section title="3. Cookies We Use">
          <p>The following table describes the specific cookies set by {APP_NAME}:</p>
          <table className="w-full text-sm border-collapse mt-2">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold">Cookie Name</th>
                <th className="text-left py-2 pr-4 font-semibold">Type</th>
                <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
                <th className="text-left py-2 font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">ncg_session</td>
                <td className="py-2 pr-4 text-muted-foreground">Essential</td>
                <td className="py-2 pr-4 text-muted-foreground">
                  Maintains your authenticated session after login via Manus OAuth. Without this
                  cookie, you would need to log in on every page visit.
                </td>
                <td className="py-2 text-muted-foreground">Session / 7 days</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs">theme</td>
                <td className="py-2 pr-4 text-muted-foreground">Functional</td>
                <td className="py-2 pr-4 text-muted-foreground">
                  Stores your preferred colour theme (light or dark) so it persists across visits.
                </td>
                <td className="py-2 text-muted-foreground">1 year</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3">
            All cookies set by {APP_NAME} are marked <strong>HttpOnly</strong> (where applicable),{" "}
            <strong>Secure</strong> (transmitted over HTTPS only), and <strong>SameSite=Lax</strong>{" "}
            to prevent cross-site request forgery. We do not use cookies to build advertising
            profiles or share data with ad networks.
          </p>
        </Section>

        <Section title="4. Third-Party Cookies">
          <p>
            {APP_NAME} does not load third-party advertising or analytics scripts that set their own
            cookies. However, when you click external links (e.g., to Amazon, Wikipedia, or an
            author's personal website), those sites may set their own cookies in accordance with
            their own cookie policies. We have no control over third-party cookies.
          </p>
        </Section>

        <Section title="5. Analytics">
          <p>
            We use a self-hosted, privacy-first analytics service to understand how the Service is
            used in aggregate. This analytics service does not use cookies and does not collect
            personally identifiable information. It tracks page views and session counts using
            anonymised, non-persistent identifiers only.
          </p>
        </Section>

        <Section title="6. Managing and Deleting Cookies">
          <p>
            You can control and delete cookies through your browser settings. Most browsers allow
            you to refuse new cookies, delete existing cookies, and set preferences for specific
            websites. Note that disabling the session cookie (<code className="text-xs bg-muted px-1 py-0.5 rounded">ncg_session</code>)
            will prevent you from staying logged in to the Service.
          </p>
          <p>
            For guidance on managing cookies in your specific browser, visit the browser's help
            documentation or a resource such as{" "}
            <a
              href="https://www.allaboutcookies.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              allaboutcookies.org
            </a>
            .
          </p>
        </Section>

        <Section title="7. Changes to This Cookie Policy">
          <p>
            We may update this Cookie Policy from time to time to reflect changes in the cookies we
            use or for other operational, legal, or regulatory reasons. When we do, we will update
            the "Last updated" date at the top of this page. Please revisit this page periodically
            to stay informed about our use of cookies.
          </p>
        </Section>

        <Section title="8. Contact Us">
          <p>
            If you have questions about our use of cookies or this Cookie Policy, please contact us:
          </p>
          <address className="not-italic text-sm space-y-1">
            <div><strong>{COMPANY_NAME}</strong></div>
            <div>
              Email:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
            </div>
            <div>
              Website:{" "}
              <a href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                {COMPANY_WEBSITE}
              </a>
            </div>
          </address>
        </Section>

        {/* Footer */}
        <footer className="pt-8 border-t border-border text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy">
              <span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span>
            </Link>
            <Link href="/terms">
              <span className="hover:text-foreground transition-colors cursor-pointer">Terms of Service</span>
            </Link>
            <Link href="/">
              <span className="hover:text-foreground transition-colors cursor-pointer">← Back to {APP_NAME}</span>
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight border-b border-border pb-2">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}
