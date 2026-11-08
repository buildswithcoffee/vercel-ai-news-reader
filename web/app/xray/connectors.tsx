"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Box = { left: number; right: number; top: number; bottom: number };

// Where an element sits inside the tour, by layout rather than by what's on screen, so lines land
// in the right place even while the feed is still zooming out.
function box(element: HTMLElement, root: HTMLElement): Box {
  let left = 0;
  let top = 0;
  for (let node: HTMLElement | null = element; node && node !== root; node = node.offsetParent as HTMLElement | null) {
    left += node.offsetLeft;
    top += node.offsetTop;
  }
  return { left, top, right: left + element.offsetWidth, bottom: top + element.offsetHeight };
}

// Draws a line from each margin note (data-note) to the part of the sketch it names (data-xray).
// A target marked data-region gets a bracket along its side. Lines draw in one after another when
// their slide comes into view (see globals.css).
export function Connectors() {
  const svg = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    const tour = svg.current!.parentElement!;
    const draw = () =>
      setPaths(
        [...tour.querySelectorAll<HTMLElement>("[data-note]")].flatMap((note) => {
          const target = tour.querySelector<HTMLElement>(`[data-xray="${note.dataset.note}"]`);
          if (!target) return [];
          const n = box(note, tour);
          const t = box(target, tour);
          const fromLeft = n.right <= t.left;
          const start = `M ${fromLeft ? n.right + 8 : n.left - 8} ${n.top + 10}`;
          const edge = fromLeft ? t.left - 6 : t.right + 6;
          if (target.hasAttribute("data-region")) {
            const spine = fromLeft ? edge - 10 : edge + 10;
            return [`${start} L ${spine} ${(t.top + t.bottom) / 2} M ${edge} ${t.top} H ${spine} V ${t.bottom} H ${edge}`];
          }
          return [`${start} L ${edge} ${(t.top + t.bottom) / 2}`];
        }),
      );
    const observer = new ResizeObserver(draw);
    observer.observe(tour);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={svg} aria-hidden fill="none" className="pointer-events-none absolute inset-0 hidden h-full w-full stroke-accent lg:block">
      {paths.map((d, index) => (
        <path key={d} d={d} pathLength={1} className="xray-line" style={{ "--i": index } as CSSProperties} />
      ))}
    </svg>
  );
}
