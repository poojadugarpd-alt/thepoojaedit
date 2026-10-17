"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  as?: "div" | "li" | "figure" | "section";
  className?: string;
  delay?: number;
  children: React.ReactNode;
};

/** Fades/slides children in the first time they enter the viewport. */
export function Reveal({ as: Tag = "div", className = "", delay = 0, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // @ts-expect-error -- ref type differs per tag; all are HTMLElement
      ref={ref}
      className={`reveal ${shown ? "is-in" : ""} ${className}`}
      style={delay ? ({ "--d": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
