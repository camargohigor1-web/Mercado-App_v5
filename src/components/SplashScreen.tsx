import { useEffect, useState } from "react";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("out"), 1600);
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
      {/* Texto (sem o ícone) */}
      <div
        style={{
          transform: phase === "in" ? "scale(0.6) translateY(12px)" : "scale(1) translateY(0px)",
          opacity: phase === "in" ? 0 : 1,
          transition: "transform 500ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease-out",
        }}
        className="flex flex-col items-center gap-5"
      >
        {/* Texto apenas - ícone removido */}
        <div className="text-center">
          <p className="text-white font-black text-2xl tracking-tight">MercadoApp</p>
          <p className="text-white/60 text-sm mt-1 font-medium">Suas compras sob controle</p>
        </div>
      </div>

      {/* Bottom loader dots (mantido) */}
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
