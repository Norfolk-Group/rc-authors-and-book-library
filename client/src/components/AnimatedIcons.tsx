/**
 * Animated Icon Components — Manus Design System
 *
 * Hand-crafted CSS animations for loading and status states.
 * Phosphor icons are static SVGs; use these for motion.
 *
 * Components:
 *   ManusSpinner   — 3D morphing blue square (primary loading indicator)
 *   SpinningArc    — Thin circular arc (inline progress)
 *   ThinkingDots   — Three bouncing dots (AI composing)
 *   PulsingRing    — Expanding pulse ring (active task indicator)
 *   SkeletonShimmer — Horizontal shimmer bar (content loading)
 */

// ── ManusSpinner ──────────────────────────────────────────────────────────────

export function ManusSpinner({ size = 40 }: { size?: number }) {
  return (
    <>
      <style>{`
        @keyframes manus-spin {
          0%   { transform: perspective(120px) rotateX(0deg) rotateY(0deg); border-radius: 20%; }
          25%  { transform: perspective(120px) rotateX(-180deg) rotateY(0deg); border-radius: 30%; }
          50%  { transform: perspective(120px) rotateX(-180deg) rotateY(-180deg); border-radius: 40%; }
          75%  { transform: perspective(120px) rotateX(0deg) rotateY(-180deg); border-radius: 30%; }
          100% { transform: perspective(120px) rotateX(0deg) rotateY(0deg); border-radius: 20%; }
        }
        .manus-spinner {
          animation: manus-spin 2s ease-in-out infinite;
          background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%);
          box-shadow: 0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(59,130,246,0.15);
        }
      `}</style>
      <div className="manus-spinner" style={{ width: size, height: size }} />
    </>
  );
}

// ── SpinningArc ───────────────────────────────────────────────────────────────

export function SpinningArc({ size = 16, color = "#3B82F6" }: { size?: number; color?: string }) {
  return (
    <>
      <style>{`
        @keyframes spin-arc { to { transform: rotate(360deg); } }
        .spin-arc { animation: spin-arc 0.8s linear infinite; }
      `}</style>
      <svg width={size} height={size} viewBox="0 0 16 16" className="spin-arc" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="6" fill="none" stroke="#E5E7EB" strokeWidth="1.5" />
        <path
          d="M 8 2 A 6 6 0 0 1 14 8"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </>
  );
}

// ── ThinkingDots ──────────────────────────────────────────────────────────────

export function ThinkingDots({ color = "#9CA3AF" }: { color?: string }) {
  return (
    <>
      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        .dot-1 { animation: dot-bounce 1.2s ease-in-out infinite 0s; }
        .dot-2 { animation: dot-bounce 1.2s ease-in-out infinite 0.2s; }
        .dot-3 { animation: dot-bounce 1.2s ease-in-out infinite 0.4s; }
      `}</style>
      <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        {["dot-1", "dot-2", "dot-3"].map((cls) => (
          <span key={cls} className={cls} style={{
            display: "block", width: 5, height: 5,
            borderRadius: "50%", background: color,
          }} />
        ))}
      </div>
    </>
  );
}

// ── PulsingRing ───────────────────────────────────────────────────────────────

export function PulsingRing({ color = "#3B82F6", size = 12 }: { color?: string; size?: number }) {
  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .pulse-ring { animation: pulse-ring 1.5s ease-out infinite; }
      `}</style>
      <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
        <span className="pulse-ring" style={{
          position: "absolute", inset: 0,
          borderRadius: "50%", background: color,
        }} />
        <span style={{
          position: "relative", width: "100%", height: "100%",
          borderRadius: "50%", background: color,
        }} />
      </span>
    </>
  );
}

// ── SkeletonShimmer ───────────────────────────────────────────────────────────

export function SkeletonShimmer({
  width = "100%",
  height = 14,
  borderRadius = 4,
}: {
  width?: string | number;
  height?: number;
  borderRadius?: number;
}) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, #F0F0F0 25%, #E8E8E8 50%, #F0F0F0 75%);
          background-size: 800px 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
      <div className="skeleton-shimmer" style={{ width, height, borderRadius }} />
    </>
  );
}
