import { useEffect, useState } from "react";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    // in → hold após 600ms
    const t1 = setTimeout(() => setPhase("hold"), 600);
    // hold → out após 1600ms
    const t2 = setTimeout(() => setPhase("out"), 1600);
    // chama onDone após fade-out (400ms)
    const t3 = setTimeout(() => onDone(), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)",
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "out" ? "opacity 400ms ease-in" : "none",
        pointerEvents: phase === "out" ? "none" : "all",
      }}
    >
      {/* Icon */}
      <div
        style={{
          transform: phase === "in" ? "scale(0.6) translateY(12px)" : "scale(1) translateY(0px)",
          opacity: phase === "in" ? 0 : 1,
          transition: "transform 500ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease-out",
        }}
        className="flex flex-col items-center gap-5"
      >
        {/* App icon */}
        <div className="w-24 h-24 rounded-[28px] bg-white/15 backdrop-blur flex items-center justify-center shadow-2xl shadow-black/20 border border-white/20">
          <svg viewBox="0 0 64 64" width="56" height="56">
            {/* cart body */}
            <path d="M10 18h5l6 20h20l5-14H24" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            {/* wheels */}
            <circle cx="29" cy="42" r="3" fill="white"/>
            <circle cx="42" cy="42" r="3" fill="white"/>
            {/* plus */}
            <circle cx="48" cy="16" r="10" fill="white" opacity="0.2"/>
            <path d="M48 11v10M43 16h10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-white font-black text-2xl tracking-tight">MercadoApp</p>
          <p className="text-white/60 text-sm mt-1 font-medium">Suas compras sob controle</p>
        </div>
      </div>

      {/* Bottom loader dots */}
      <div
        className="absolute bottom-16 flex gap-1.5"
        style={{
          opacity: phase === "in" ? 0 : 0.6,
          transition: "opacity 400ms ease-out 300ms",
        }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-white"
            style={{ animation: `splashDot 1s ease-in-out ${i * 160}ms infinite` }}
          />
        ))}
      </div>
    </div>
  );
}
