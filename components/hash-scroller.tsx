"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function HashScroller() {
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    const timers: number[] = [];

    function tryScrollOnce() {
      try {
        // Only perform scrolling when the footer set the flag or the query param is present
        let shouldScroll = false;
        try {
          const url = new URL(window.location.href);
          const p = url.searchParams.get("scroll");
          if (p) shouldScroll = true;
        } catch {}

        if (!shouldScroll) {
          try {
            const flag = sessionStorage.getItem("scrollToRefund");
            if (flag === "1") shouldScroll = true;
          } catch {}
        }

        if (!shouldScroll) return false;

        const { hash } = window.location;
        if (!hash) return false;
        const id = hash.slice(1);
        const el = document.getElementById(id);
        if (el) {
          if (!el.hasAttribute("tabIndex")) el.setAttribute("tabIndex", "-1");
          try {
            (el as HTMLElement).focus({ preventScroll: true } as any);
          } catch {}

          // Find fixed or sticky top elements using an explicit loop
          try {
            const all = document.getElementsByTagName(
              "*",
            ) as HTMLCollectionOf<HTMLElement>;
            let headerOffset = 0;
            for (let i = 0; i < all.length; i++) {
              const node = all[i];
              try {
                const s = getComputedStyle(node);
                if (
                  (s.position === "fixed" || s.position === "sticky") &&
                  node.offsetHeight > 0
                ) {
                  const rect = node.getBoundingClientRect();
                  if (rect.top <= 1) {
                    headerOffset += rect.height;
                  }
                }
              } catch {}
            }

            const rect = (el as HTMLElement).getBoundingClientRect();
            const targetY = window.scrollY + rect.top - headerOffset - 8;
            window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
          } catch {
            (el as HTMLElement).scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }

          try {
            sessionStorage.removeItem("scrollToRefund");
          } catch {}

          // remove the query param so future navigations don't auto-scroll
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("scroll");
            history.replaceState(null, "", url.toString());
          } catch {}

          return true;
        }
      } catch (e) {
        // ignore
      }
      return false;
    }

    function normalizeHash() {
      try {
        const href = window.location.href;
        const idx = href.indexOf("#");
        if (idx === -1) return;
        const hash = href.slice(idx + 1);
        if (!hash) return;
        if (hash.indexOf("#") !== -1) {
          const first = hash.split("#")[0];
          const clean = href.slice(0, idx + 1) + first;
          history.replaceState(null, "", clean);
        }
      } catch {}
    }

    normalizeHash();
    const delays = [0, 120, 350, 800, 1400];
    for (let i = 0; i < delays.length; i++) {
      const d = delays[i];
      const id = window.setTimeout(() => {
        if (!mounted) return;
        const ok = tryScrollOnce();
        if (ok) {
          for (let j = 0; j < timers.length; j++) clearTimeout(timers[j]);
        }
      }, d);
      timers.push(id);
    }

    const onHash = () => {
      normalizeHash();
      tryScrollOnce();
      const more = [150, 400, 900];
      for (let i = 0; i < more.length; i++) {
        const id = window.setTimeout(tryScrollOnce, more[i]);
        timers.push(id);
      }
    };

    window.addEventListener("hashchange", onHash);

    return () => {
      mounted = false;
      for (let i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      window.removeEventListener("hashchange", onHash);
    };
  }, [pathname]);

  return null;
}
