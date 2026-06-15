// Lottie animation — three pulsing dots (loading / waiting indicator).
// Monochrome Norfolk-AI teal (#0091AE) to fit the editorial, business-like
// design system. Exported as a TS module so we don't need resolveJsonModule.
// Seamless 1s loop at 60fps; each dot's opacity dips in a left-to-right wave.

const EASE_IN = { x: [0.4], y: [1] };
const EASE_OUT = { x: [0.6], y: [0] };
const TEAL = [0, 0.569, 0.682, 1];

function dot(ind: number, x: number, dipStart: number): Record<string, unknown> {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: `dot${ind}`,
    sr: 1,
    ks: {
      o: {
        a: 1,
        k: [
          { t: 0, s: [100], o: EASE_OUT, i: EASE_IN },
          { t: dipStart, s: [100], o: EASE_OUT, i: EASE_IN },
          { t: dipStart + 12, s: [30], o: EASE_OUT, i: EASE_IN },
          { t: dipStart + 24, s: [100] },
        ],
      },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [x, 60, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        nm: "g",
        it: [
          { ty: "el", d: 1, s: { a: 0, k: [18, 18] }, p: { a: 0, k: [0, 0] }, nm: "e" },
          { ty: "fl", c: { a: 0, k: TEAL }, o: { a: 0, k: 100 }, r: 1, nm: "f" },
          {
            ty: "tr",
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
            nm: "t",
          },
        ],
      },
    ],
    ip: 0,
    op: 60,
    st: 0,
    bm: 0,
  };
}

const loadingDots: Record<string, unknown> = {
  v: "5.9.0",
  fr: 60,
  ip: 0,
  op: 60,
  w: 120,
  h: 120,
  nm: "loading-dots",
  ddd: 0,
  assets: [],
  layers: [dot(1, 42, 0), dot(2, 60, 10), dot(3, 78, 20)],
  markers: [],
};

export default loadingDots;
