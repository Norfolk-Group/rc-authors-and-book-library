import { lazy, Suspense } from "react";
import loadingDots from "@/assets/lottie/loadingDots";

// lottie-react (and its lottie-web engine) is lazy-loaded so it stays out of the
// main bundle. While it loads, a lightweight CSS spinner stands in.
const Lottie = lazy(() => import("lottie-react"));

type Props = {
  /** Pixel size of the animation (width = height). */
  size?: number;
  /** Optional caption shown beneath the animation. */
  label?: string;
  className?: string;
};

/**
 * Animated loading / waiting indicator (Lottie "pulsing dots").
 * Use anywhere the app is fetching, processing, or waiting.
 */
export function LottieLoader({ size = 88, label, className = "" }: Props) {
  const fallback = (
    <div
      className="border-2 border-primary border-t-transparent rounded-full animate-spin"
      style={{ width: Math.round(size / 3), height: Math.round(size / 3) }}
      aria-hidden
    />
  );

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-muted-foreground ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <Suspense fallback={fallback}>
        <Lottie animationData={loadingDots} loop style={{ width: size, height: size }} />
      </Suspense>
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export default LottieLoader;
