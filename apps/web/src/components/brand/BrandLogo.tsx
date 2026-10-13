"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BrandLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  variant?: "icon" | "full" | "wordmark";
  showBadge?: boolean;
  badgeText?: string;
  withSparkle?: boolean;
}

export function BrandIcon({
  size = 32,
  className,
  withSparkle = true,
}: {
  size?: number;
  className?: string;
  withSparkle?: boolean;
}) {
  const rawId = React.useId();
  // Safe sanitized ID for SVG gradient references
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-label="SmartTask Icon"
      role="img"
    >
      <defs>
        {/* Background container gradient */}
        <linearGradient id={`st-bg-${id}`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B132B" />
          <stop offset="50%" stopColor="#1C2541" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Primary flow ribbon: Cyan -> Electric Indigo -> Violet */}
        <linearGradient id={`st-flow-${id}`} x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="45%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Checkmark momentum: Emerald -> Amber */}
        <linearGradient id={`st-check-${id}`} x1="16" y1="28" x2="36" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        {/* Subtle inner border gradient */}
        <linearGradient id={`st-border-${id}`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.28)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
        </linearGradient>

        {/* Soft shadow filter */}
        <filter id={`st-shadow-${id}`} x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6366F1" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Outer rounded squircle */}
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="45"
        rx="12"
        fill={`url(#st-bg-${id})`}
        stroke={`url(#st-border-${id})`}
        strokeWidth="1.5"
      />

      {/* Ambient background glow orb */}
      <circle cx="24" cy="24" r="14" fill="#6366F1" opacity="0.18" filter="blur(6px)" />

      {/* Main S-Curve ribbon: Agile continuous flow */}
      <path
        d="M 14 18 C 14 13.5, 18 11, 24 11 C 30.5 11, 34 13.5, 34 17.5 C 34 21.5, 29.5 23.2, 24 24.5 C 18.5 25.8, 14 27.5, 14 31.8 C 14 36, 18.5 38.5, 24.5 38.5 C 31 38.5, 34.5 35.8, 35.5 31.5"
        stroke={`url(#st-flow-${id})`}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        filter={`url(#st-shadow-${id})`}
      />

      {/* Checkmark forward leap: Represents task completion & velocity */}
      <path
        d="M 19 25.5 L 23.5 30 L 33.5 18.5"
        stroke={`url(#st-check-${id})`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* AI Intelligence Sparkle (4-point star at top-right) */}
      {withSparkle && (
        <path
          d="M 37 6.5 C 37 9, 38.5 10.5, 41 10.5 C 38.5 10.5, 37 12, 37 14.5 C 37 12, 35.5 10.5, 33 10.5 C 35.5 10.5, 37 9, 37 6.5 Z"
          fill="#FACC15"
          opacity="0.95"
        />
      )}
    </svg>
  );
}

export function BrandLogo({
  size = "md",
  variant = "full",
  showBadge = false,
  badgeText = "AI",
  withSparkle = true,
  className,
  ...props
}: BrandLogoProps) {
  const pixelSize =
    typeof size === "number"
      ? size
      : size === "xs"
      ? 20
      : size === "sm"
      ? 28
      : size === "md"
      ? 36
      : size === "lg"
      ? 44
      : 56;

  const textSizes = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-2xl",
  };

  const textSize = typeof size === "string" ? textSizes[size] : "text-base";

  return (
    <div
      className={cn("inline-flex items-center gap-2.5 select-none", className)}
      aria-label="SmartTask Logo"
      {...props}
    >
      {variant !== "wordmark" && (
        <BrandIcon size={pixelSize} withSparkle={withSparkle} />
      )}

      {variant !== "icon" && (
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={cn(
              "font-extrabold tracking-tight text-foreground transition-colors",
              textSize
            )}
          >
            Smart
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Task
            </span>
          </span>

          {showBadge && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
              {badgeText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
