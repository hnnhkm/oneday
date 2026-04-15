"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Client wrapper around the server-rendered Header contents. Its only
 * job is to track whether the page has been scrolled past a small
 * threshold and expose that as `data-scrolled` on the <header> so
 * children can respond via Tailwind's `group-data-[scrolled=true]:`
 * variants. Kept as a thin boundary so the parent Header component
 * can stay a Server Component and continue to do its async user/data
 * fetching without becoming "use client".
 *
 * The header uses `sticky top-0` — it stays anchored as the page
 * scrolls, gradually getting a touch denser (slightly more opaque
 * background, shorter row, smaller logo) once the user moves past
 * the first few pixels. Transition runs on the inner row and the
 * logo so the shrink feels smooth rather than snappy.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mirror the scroll state onto <html> so any element on the page
  // (not just descendants of <header>) can respond to it via Tailwind's
  // arbitrary ancestor-attribute variant, e.g.
  //   [html[data-scrolled=true]_&]:py-1
  // That's how the search bar's mobile pill and desktop segments
  // shrink their vertical padding as the user scrolls.
  useEffect(() => {
    document.documentElement.dataset.scrolled = scrolled ? "true" : "false";
  }, [scrolled]);

  // Keep `--header-h` on <html> in sync with the live rendered height
  // of the header (which animates between rest and scrolled states,
  // and differs by breakpoint). Sticky children — notably the filter
  // pill row — use `top-[var(--header-h)]` so they always dock flush
  // under the header with no gap when it compacts. ResizeObserver
  // catches both the size transition and responsive breakpoint flips;
  // scroll state is also fed in so the observer fires during the
  // 200ms CSS shrink.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const sync = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--header-h", `${h}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    // Also re-sync during the shrink transition — getBoundingClientRect
    // reports the animating height each frame, so a short rAF loop
    // tracks it smoothly without listening to transitionend (which
    // fires once per property and can miss the interim states).
    let raf = 0;
    let ticks = 0;
    const tick = () => {
      sync();
      ticks += 1;
      if (ticks < 20) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [scrolled]);

  return (
    <header
      ref={headerRef}
      data-scrolled={scrolled}
      className="group sticky top-0 z-40 border-b border-charcoal-lighter/10 bg-white/70 backdrop-blur-md transition-colors duration-200 data-[scrolled=true]:bg-white/90"
    >
      {children}
    </header>
  );
}
