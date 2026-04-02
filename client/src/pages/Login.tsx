/**
 * Login.tsx — /login route
 *
 * Uses the shadcn login-04 layout as a visual shell.
 * Authentication is handled via Manus OAuth (redirects to the OAuth portal).
 *
 * If the user is already authenticated, redirects to home.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, BookOpen, Brain, Sparkle } from "lucide-react";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect to home if already logged in
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSignIn = () => {
    window.location.href = getLoginUrl();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <Card className="overflow-hidden shadow-2xl border-border/60">
          <CardContent className="grid p-0 md:grid-cols-2">
            {/* ── Left: Sign-in panel ── */}
            <div className="flex flex-col gap-6 p-8 md:p-10">
              {/* Logo + Title */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">NCG Library</span>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Your personal intelligence library — authors, books, and ideas that matter.
                </p>
              </div>

              {/* Divider */}
              <div className="h-px bg-border/60" />

              {/* Sign-in section */}
              <div className="flex flex-col gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sign in to access your library and Digital Me conversations.
                  </p>
                </div>

                <Button
                  size="lg"
                  className="w-full gap-2 font-semibold"
                  onClick={handleSignIn}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.2" />
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Continue with Manus
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Secure sign-in via Manus OAuth. No password required.
                </p>
              </div>

              {/* Features */}
              <div className="flex flex-col gap-3 mt-2">
                <FeatureRow icon={<BookOpen className="w-4 h-4 text-primary" />} text="Browse 100+ curated authors and books" />
                <FeatureRow icon={<Brain className="w-4 h-4 text-violet-500" />} text="Chat with Digital Me author simulations" />
                <FeatureRow icon={<Sparkle className="w-4 h-4 text-amber-500" />} text="AI-powered insights and recommendations" />
              </div>

              {/* Footer */}
              <div className="mt-auto text-xs text-center text-muted-foreground">
                By signing in, you agree to our{" "}
                <a href="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
                .
              </div>
            </div>

            {/* ── Right: Visual panel ── */}
            <div className="relative hidden md:flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-violet-500/10 to-amber-500/10 p-10 overflow-hidden">
              {/* Decorative blobs */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

              <div className="relative z-10 flex flex-col items-center gap-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm shadow-xl border border-border/60">
                  <BookOpen className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Intelligence Library</h2>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
                    A curated collection of the world's most impactful authors, their ideas, and their digital personas.
                  </p>
                </div>

                {/* Stat pills */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <StatPill value="100+" label="Authors" color="bg-primary/10 text-primary" />
                  <StatPill value="500+" label="Books" color="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
                  <StatPill value="AI" label="Digital Me" color="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
      <div className="flex-shrink-0">{icon}</div>
      <span>{text}</span>
    </div>
  );
}

function StatPill({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${color} border border-current/20`}>
      <span className="font-bold">{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}
