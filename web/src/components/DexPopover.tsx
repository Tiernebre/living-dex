import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const POPOVER_WIDTH = 420;
const POPOVER_MARGIN = 8;
const POPOVER_GAP = 12;

export function DexPopover({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
    arrowLeft: number;
    placement: "top" | "bottom";
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const anchorRect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(POPOVER_WIDTH, vw - POPOVER_MARGIN * 2);

      const spaceAbove = Math.max(0, anchorRect.top - POPOVER_MARGIN - POPOVER_GAP);
      const spaceBelow = Math.max(0, vh - anchorRect.bottom - POPOVER_MARGIN - POPOVER_GAP);
      // Pick the side with more room; clamp measured height to that side so a
      // very tall popover stays anchored and scrolls internally instead of
      // running off-screen.
      const placement: "top" | "bottom" = spaceAbove >= spaceBelow ? "top" : "bottom";
      const sideSpace = Math.max(120, placement === "top" ? spaceAbove : spaceBelow);
      const maxHeight = Math.max(120, Math.min(el.scrollHeight, sideSpace));
      const height = Math.min(el.offsetHeight, maxHeight);

      const anchorCenter = anchorRect.left + anchorRect.width / 2;
      const left = Math.min(
        Math.max(POPOVER_MARGIN, anchorCenter - width / 2),
        Math.max(POPOVER_MARGIN, vw - width - POPOVER_MARGIN),
      );

      const top =
        placement === "top"
          ? Math.max(POPOVER_MARGIN, anchorRect.top - height - POPOVER_GAP)
          : Math.min(vh - height - POPOVER_MARGIN, anchorRect.bottom + POPOVER_GAP);

      const arrowLeft = Math.min(Math.max(14, anchorCenter - left), width - 14);

      setPos({ left, top, width, arrowLeft, placement, maxHeight });
    };

    place();
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      className={`dex-popover dex-popover-${pos?.placement ?? "top"}`}
      role="dialog"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        width: pos?.width ?? POPOVER_WIDTH,
        maxHeight: pos?.maxHeight,
        overflowY: "auto",
        overscrollBehavior: "contain",
        visibility: pos ? "visible" : "hidden",
        ["--arrow-left" as string]: pos ? `${pos.arrowLeft}px` : "50%",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
