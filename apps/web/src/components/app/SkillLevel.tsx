import * as React from "react";
import { cn } from "@/lib/utils";

interface SkillLevelProps {
  level: number; // 1 - 5
  maxLevel?: number;
  className?: string;
  showText?: boolean;
}

export function SkillLevel({
  level,
  maxLevel = 5,
  className,
  showText = false,
}: SkillLevelProps) {
  // Chart colors 1..5 matching skill maturity level:
  // 1: chart-1, 2: chart-2, 3: chart-3, 4: chart-4, 5: chart-5
  const colorMap: Record<number, string> = {
    1: "bg-[hsl(var(--chart-1))]",
    2: "bg-[hsl(var(--chart-2))]",
    3: "bg-[hsl(var(--chart-3))]",
    4: "bg-[hsl(var(--chart-4))]",
    5: "bg-[hsl(var(--chart-5))]",
  };

  const activeColor = colorMap[level] || "bg-primary";

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5" aria-label={`Mức kỹ năng: ${level}/${maxLevel}`}>
        {Array.from({ length: maxLevel }).map((_, i) => {
          const isFilled = i < level;
          return (
            <span
              key={i}
              className={cn(
                "h-2 w-2 rounded-xs transition-colors",
                isFilled ? activeColor : "bg-muted/70"
              )}
            />
          );
        })}
      </div>
      {showText && (
        <span className="text-xs font-mono font-medium text-muted-foreground tabular-nums">
          {level}/{maxLevel}
        </span>
      )}
    </div>
  );
}
