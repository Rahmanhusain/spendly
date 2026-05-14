"use client";

import { useEffect, useRef, useState } from "react";

export function ScrollIndicator() {
  const [visible, setVisible] = useState(false);
  const [centerX, setCenterX] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const main = document.querySelector("main");

    function measureMain() {
      if (!main) return;
      const rect = main.getBoundingClientRect();
      setCenterX(rect.left + rect.width / 2);
    }

    function checkScroll() {
      // Hide once user has scrolled past 30% of the total scrollable distance
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        setVisible(false);
        return;
      }
      const progress = window.scrollY / scrollable;
      setVisible(progress < 0.3);
    }

    function onUpdate() {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        measureMain();
        checkScroll();
      });
    }

    measureMain();
    checkScroll();

    window.addEventListener("scroll", onUpdate, { passive: true });
    window.addEventListener("resize", onUpdate, { passive: true });

    return () => {
      window.removeEventListener("scroll", onUpdate);
      window.removeEventListener("resize", onUpdate);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function scrollDown() {
    window.scrollBy({ top: window.innerHeight * 0.75, behavior: "smooth" });
  }

  if (!visible || centerX === null) return null;

  return (
    <>
      <style>{`
        @keyframes siFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes siPulseRing {
          0%   { transform: scale(1);    opacity: 0.6; }
          70%  { transform: scale(1.55); opacity: 0;   }
          100% { transform: scale(1.55); opacity: 0;   }
        }
        @keyframes siArrow {
          0%, 100% { transform: translateY(0);   }
          50%       { transform: translateY(5px); }
        }
        @keyframes siArrow2 {
          0%, 100% { transform: translateY(0);   opacity: 0.35; }
          50%       { transform: translateY(5px); opacity: 0.9;  }
        }
      `}</style>

      <button
        type="button"
        onClick={scrollDown}
        aria-label="Scroll down to see more"
        style={{
          position: "fixed",
          bottom: "2.25rem",
          left: `${centerX}px`,
          transform: "translateX(-50%)",
          animation: "siFadeIn 0.5s cubic-bezier(0.22,1,0.36,1) both",
          zIndex: 50,
        }}
        className="group flex flex-col items-center gap-2 outline-none"
      >
        {/* Label pill */}
        <span
          className="
            rounded-full border border-slate-200 bg-white/95 backdrop-blur-md
            px-4 py-1.5 text-[11px] font-semibold tracking-wide text-slate-500
            shadow-[0_2px_12px_rgba(15,23,42,0.08)]
            transition-all duration-200
            group-hover:border-emerald-300 group-hover:text-emerald-700
            group-hover:shadow-[0_4px_20px_rgba(16,185,129,0.18)]
          "
        >
          More below
        </span>

        {/* Pulsing ring + arrow icon */}
        <span className="relative flex h-9 w-9 items-center justify-center">
          {/* Outer pulse ring */}
          <span
            className="absolute inset-0 rounded-full bg-emerald-400"
            style={{ animation: "siPulseRing 1.8s ease-out infinite" }}
          />
          {/* Second ring, offset */}
          <span
            className="absolute inset-0 rounded-full bg-emerald-400"
            style={{ animation: "siPulseRing 1.8s ease-out 0.6s infinite" }}
          />
          {/* Button disc */}
          <span
            className="
              relative z-10 flex h-9 w-9 items-center justify-center rounded-full
              bg-white shadow-[0_2px_10px_rgba(15,23,42,0.12)]
              border border-slate-200
              transition-all duration-200
              group-hover:border-emerald-300 group-hover:shadow-[0_4px_18px_rgba(16,185,129,0.22)]
              group-hover:bg-emerald-50
            "
          >
            {/* Double-chevron SVG — no lucide dep needed here */}
            <svg
              viewBox="0 0 16 20"
              fill="none"
              className="h-4 w-4"
              aria-hidden
            >
              <path
                d="M3 3l5 5 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-400 transition-colors group-hover:text-emerald-600"
                style={{ animation: "siArrow 1.4s ease-in-out infinite" }}
              />
              <path
                d="M3 9l5 5 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-300 transition-colors group-hover:text-emerald-400"
                style={{
                  animation: "siArrow2 1.4s ease-in-out 0.15s infinite",
                }}
              />
            </svg>
          </span>
        </span>
      </button>
    </>
  );
}
