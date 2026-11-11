"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type HoldState = "idle" | "holding" | "completed" | "cancelled";

export interface HoldToDeleteProps {
  onTrigger?: () => void | Promise<void>;
  label?: string;
  holdingLabel?: string;
  completedLabel?: string;
  holdDurationMs?: number;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  /** Force an exact visual state for deterministic preview testing and screenshots */
  forcedState?: "rest" | "mid" | "completed" | "cancelled";
  /** Descriptive item name for accessibility (e.g. "Closet piece", "order", "photo") */
  itemDescription?: string;
  /** When true, completing the hold triggers HTML5 form submission (form.requestSubmit()) */
  isSubmit?: boolean;
  /** Action verb for accessibility announcements (defaults to "cancel" if label contains cancel, else "delete") */
  actionVerb?: "delete" | "cancel" | string;
}

export function HoldToDelete({
  onTrigger,
  label = "Hold to delete",
  holdingLabel = "Keep holding…",
  completedLabel = "Deleted",
  holdDurationMs = 1000,
  disabled = false,
  className = "",
  compact = false,
  forcedState,
  itemDescription = "item",
  isSubmit = false,
  actionVerb,
}: HoldToDeleteProps) {
  const [state, setState] = useState<HoldState>("idle");
  const [progress, setProgress] = useState(0); // 0 to 100
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const isHoldingKeyRef = useRef(false);
  const wasDisabledRef = useRef(disabled);

  // Derive action verb for screen reader clarity
  const verb =
    actionVerb ?? (label.toLowerCase().includes("cancel") ? "cancel" : "delete");
  const pastTense =
    verb === "delete" ? "deleted" : verb === "cancel" ? "cancelled" : `${verb}ed`;
  const capitalizedVerb = verb.charAt(0).toUpperCase() + verb.slice(1);

  // If disabled transitions from true (pending action) back to false (idle), reset completed state
  useEffect(() => {
    if (wasDisabledRef.current && !disabled && state === "completed") {
      setState("idle");
      setProgress(0);
    }
    wasDisabledRef.current = disabled;
  }, [disabled, state]);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const cancelHold = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    isHoldingKeyRef.current = false;

    if (state === "holding") {
      setState("cancelled");
      setProgress(0);
      resetTimerRef.current = setTimeout(() => {
        setState("idle");
        resetTimerRef.current = null;
      }, 1200);
    } else if (state !== "completed") {
      setState("idle");
      setProgress(0);
    }
  }, [state]);

  const triggerCompletion = useCallback(() => {
    setState("completed");
    setProgress(100);
    isHoldingKeyRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (isSubmit && buttonRef.current?.form) {
      buttonRef.current.form.requestSubmit();
    } else {
      void onTrigger?.();
    }
  }, [isSubmit, onTrigger]);

  const startHold = useCallback(() => {
    if (disabled || state === "completed") return;

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    setState("holding");
    startTimeRef.current = Date.now();

    // Respect reduced-motion: skip continuous frame animation, but KEEP the full hold duration
    const isReduced = prefersReducedMotion();
    if (!isReduced) {
      const updateLoop = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const pct = Math.min(100, (elapsed / holdDurationMs) * 100);
        setProgress(pct);

        if (elapsed < holdDurationMs) {
          animFrameRef.current = requestAnimationFrame(updateLoop);
        }
      };
      animFrameRef.current = requestAnimationFrame(updateLoop);
    } else {
      setProgress(0);
    }

    timerRef.current = setTimeout(() => {
      triggerCompletion();
    }, holdDurationMs);
  }, [disabled, state, prefersReducedMotion, holdDurationMs, triggerCompletion]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  // Keyboard handlers (Space or Enter)
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      // Space scrolls by default; prevent that
      e.preventDefault();
      if (e.repeat) return; // Ignore autorepeat
      isHoldingKeyRef.current = true;
      startHold();
    } else if (e.key === "Escape") {
      cancelHold();
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      isHoldingKeyRef.current = false;
      if (state === "holding") {
        cancelHold();
      }
    }
  };

  // Pointer handlers (Mouse & Touch)
  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // Left click / primary touch only
    e.currentTarget.setPointerCapture(e.pointerId);
    startHold();
  };

  const handlePointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (state === "holding") {
      cancelHold();
    }
  };

  const handlePointerCancel = () => {
    if (state === "holding") {
      cancelHold();
    }
  };

  // Override visual state if forced (for previews & automated screenshot testing)
  const effectiveState: HoldState =
    forcedState === "rest"
      ? "idle"
      : forcedState === "mid"
        ? "holding"
        : forcedState === "completed"
          ? "completed"
          : forcedState === "cancelled"
            ? "cancelled"
            : state;

  const effectiveProgress =
    forcedState === "rest"
      ? 0
      : forcedState === "mid"
        ? 52
        : forcedState === "completed"
          ? 100
          : forcedState === "cancelled"
            ? 0
            : progress;

  // Visual label logic
  let displayLabel = label;
  if (effectiveState === "holding") {
    displayLabel = holdingLabel;
  } else if (effectiveState === "completed") {
    displayLabel = completedLabel;
  } else if (effectiveState === "cancelled") {
    displayLabel = "Cancelled";
  }

  const heightClass = compact ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || effectiveState === "completed"}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={cancelHold}
        data-testid="hold-to-delete-button"
        data-hold-state={effectiveState}
        data-hold-progress={Math.round(effectiveProgress)}
        aria-label={`Hold for 1 second to ${verb} ${itemDescription}`}
        className={`group relative overflow-hidden select-none rounded border font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong active:scale-[0.99] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed ${heightClass} ${
          effectiveState === "completed"
            ? "border-stop bg-stop text-ground"
            : effectiveState === "cancelled"
              ? "border-stop/40 bg-stop-bg/40 text-stop"
              : "border-stop bg-stop-bg/20 hover:bg-stop-bg/30 text-stop"
        } ${className}`}
        style={{ WebkitTouchCallout: "none" }}
      >
        {/* Layer 1: Base state (Dark red text on warm background) */}
        <span className="relative z-0 flex items-center justify-center text-stop font-semibold">
          {displayLabel}
        </span>

        {/* Layer 2: Clip-path progress fill with perfectly aligned white text */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stop text-ground font-semibold transition-[clip-path] ease-linear motion-reduce:transition-none"
          style={{
            clipPath: `inset(0 ${100 - effectiveProgress}% 0 0)`,
            transitionDuration:
              effectiveState === "holding" && !forcedState ? "50ms" : "150ms",
          }}
        >
          {displayLabel}
        </div>
      </button>

      {/* Screen reader live region for keyboard & assistive technology users */}
      <div className="sr-only" aria-live="polite" role="status">
        {effectiveState === "holding"
          ? `Holding to ${verb}… keep holding for 1 second.`
          : effectiveState === "completed"
            ? `${itemDescription} ${pastTense}.`
            : effectiveState === "cancelled"
              ? `${capitalizedVerb} action cancelled.`
              : `Press and hold Space or Enter for 1 second to ${verb} ${itemDescription}.`}
      </div>
    </div>
  );
}
