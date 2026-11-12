"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Line = { x1: number; y1: number; x2: number; y2: number };
type Grid = { left: number; width: number; height: number; lines: Line[]; pluses: [number, number][] };

const REACH = 48; // how far the sides run past the feed, above and below

// Faint grid lines along the front page's real edges, as on vercel.com: the feed's two sides, the top
// of the lead story, the gap under it, and the gap between the two cards. They're measured from the
// stories themselves, so they follow the layout at every width, and draw in once, then fade back.
// The drawing spans exactly the page's width, so it never causes a sideways scroll.
export function GridLines() {
  const svg = useRef<SVGSVGElement>(null);
  const [grid, setGrid] = useState<Grid | null>(null);

  useLayoutEffect(() => {
    const feed = svg.current!.parentElement!.querySelector("ol")!;
    function measure() {
      const box = feed.getBoundingClientRect();
      const [lead, first, second] = [...feed.children].map((story) => story.getBoundingClientRect());
      if (!lead) return setGrid(null);
      const width = document.documentElement.clientWidth;
      // Page coordinates: x from the window's left edge, y from the feed's top plus REACH. Half
      // pixels keep 1px lines crisp.
      const x = (value: number) => Math.round(value) + 0.5;
      const y = (value: number) => Math.round(value - box.top + REACH) + 0.5;
      const height = box.height + 2 * REACH;
      const [left, right, top] = [x(box.left), x(box.right), y(lead.top)];
      const lines: Line[] = [
        { x1: left, y1: 0, x2: left, y2: height },
        { x1: right, y1: 0, x2: right, y2: height },
        { x1: 0, y1: top, x2: width, y2: top },
      ];
      const pluses: [number, number][] = [[left, top], [right, top]];
      if (first) {
        const under = y((lead.bottom + first.top) / 2);
        lines.push({ x1: 0, y1: under, x2: width, y2: under });
        // The split between the cards, only while they sit side by side.
        if (second && Math.abs(first.top - second.top) < 1) {
          const split = x((first.right + second.left) / 2);
          lines.push({ x1: split, y1: under, x2: split, y2: y(Math.max(first.bottom, second.bottom)) });
          pluses.push([split, under]);
        }
      }
      setGrid({ left: -box.left, width, height, lines, pluses });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(feed);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={svg}
      aria-hidden
      className="pointer-events-none absolute"
      style={grid ? { left: grid.left, top: -REACH, width: grid.width, height: grid.height } : { display: "none" }}
    >
      {grid?.lines.map((line, index) => (
        <line key={index} {...line} pathLength={1} className="grid-line" style={{ animationDelay: `${index * 0.08}s, ${1 + index * 0.08}s` }} />
      ))}
      {grid?.pluses.map(([px, py], index) => (
        <path key={index} d={`M${px - 6} ${py}h12M${px} ${py - 6}v12`} className="grid-plus" />
      ))}
    </svg>
  );
}
