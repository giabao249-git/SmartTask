import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { percentToWorkload, levelToVariant, type WorkloadLevel } from "@/lib/status";
import { cn } from "@/lib/utils";

interface WorkloadBadgeProps {
  percent?: number;
  level?: WorkloadLevel | string;
  showPercent?: boolean;
  className?: string;
}

export function WorkloadBadge({
  percent,
  level,
  showPercent = true,
  className,
}: WorkloadBadgeProps) {
  if (percent !== undefined) {
    const info = percentToWorkload(percent);
    return (
      <Badge
        variant={info.variant}
        className={cn("tabular-nums text-[11px] font-medium px-2 py-0.5", className)}
      >
        {showPercent ? `${percent}% · ${info.label}` : info.label}
      </Badge>
    );
  }

  const variant = levelToVariant(level || "NORMAL");
  return (
    <Badge
      variant={variant}
      className={cn("text-[11px] font-medium px-2 py-0.5", className)}
    >
      {level || "Bình thường"}
    </Badge>
  );
}
