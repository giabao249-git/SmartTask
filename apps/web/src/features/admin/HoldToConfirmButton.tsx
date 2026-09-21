"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HoldToConfirmButtonProps extends Omit<ButtonProps, "onClick"> {
  onConfirm: () => void;
  holdDurationMs?: number;
  label: string;
  holdingLabel?: string;
  progressColor?: string;
}

export function HoldToConfirmButton({
  onConfirm,
  holdDurationMs = 2500,
  label,
  holdingLabel = "Giữ để xác nhận...",
  className,
  variant = "destructive",
  disabled,
  ...props
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = React.useState(0);
  const [isHolding, setIsHolding] = React.useState(false);
  const startTimeRef = React.useRef<number | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);

  const cancelHold = React.useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    startTimeRef.current = null;
    setIsHolding(false);
    setProgress(0);
  }, []);

  const handleMouseDown = () => {
    if (disabled) return;
    setIsHolding(true);
    startTimeRef.current = performance.now();

    const loop = (currentTime: number) => {
      if (!startTimeRef.current) return;
      const elapsed = currentTime - startTimeRef.current;
      const currentProgress = Math.min(100, (elapsed / holdDurationMs) * 100);
      setProgress(currentProgress);

      if (currentProgress >= 100) {
        cancelHold();
        onConfirm();
      } else {
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <Button
      {...props}
      variant={variant}
      disabled={disabled}
      className={cn("relative overflow-hidden select-none transition-all", className)}
      onMouseDown={handleMouseDown}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={handleMouseDown}
      onTouchEnd={cancelHold}
    >
      {/* Progress fill overlay */}
      {isHolding && (
        <span
          className="absolute left-0 top-0 bottom-0 bg-white/25 pointer-events-none transition-[width] duration-75"
          style={{ width: `${progress}%` }}
        />
      )}
      <span className="relative z-10 font-semibold tracking-wide">
        {isHolding ? holdingLabel : label}
      </span>
    </Button>
  );
}
