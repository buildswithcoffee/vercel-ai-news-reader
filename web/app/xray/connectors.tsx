"use client";

import { useEffect, useRef, useState } from "react";

// Draws a line from each margin note to the part of the sketch it explains, matched by
// data-note and data-target. A target marked data-region gets a bracket along its side.
export function Connectors() {
  const svg = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    const tour = svg.current!.parentElement!;
    const draw = () => {
      const origin = tour.getBoundingClientRect();
      const box = (element: Element) => {
        const { left, right, top, bottom } = element.getBoundingClientRect();
        return { left: left - origin.left, right: right - origin.left, top: top - origin.top, bottom: bottom - origin.top };
      };
      setPaths(
        [...tour.querySelectorAll("[data-note]")].flatMap((note) => {
          const target = tour.querySelector(`[data-target="${note.getAttribute("data-note")}"]`);
          if (!target) return [];
          const n = box(note);
          const t = box(target);
          const fromLeft = n.right <= t.left;
          const start = `M ${fromLeft ? n.right + 8 : n.left - 8} ${n.top + 10}`;
          const edge = fromLeft ? t.left - 6 : t.right + 6;
          if (target.hasAttribute("data-region")) {
            const spine = fromLeft ? edge - 10 : edge + 10;
            return [`M ${edge} ${t.top} H ${spine} V ${t.bottom} H ${edge} ${start} L ${spine} ${(t.top + t.bottom) / 2}`];
          }
          return [`${start} L ${edge} ${(t.top + t.bottom) / 2}`];
        }),
      );
    };
    const observer = new ResizeObserver(draw);
    observer.observe(tour);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={svg} aria-hidden fill="none" className="pointer-events-none absolute inset-0 hidden h-full w-full stroke-accent lg:block">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
