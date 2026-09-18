import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { priorityToVariant, type PriorityLevel } from "@/lib/status";
import { ArrowDown, ArrowRight, ArrowUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: PriorityLevel | string;
  className?: string;
  showIcon?: boolean;
}

export function PriorityBadge({
  priority,
  className,
  showIcon = true,
}: PriorityBadgeProps) {
  const variant = priorityToVariant(priority);

  const getLabel = (p: string) => {
    switch (p) {
      case "LOW":
      case "Thấp":
        return "Thấp";
      case "MEDIUM":
      case "Trung bình":
        return "Trung bình";
      case "HIGH":
      case "Cao":
        return "Cao";
      case "URGENT":
      case "Khẩn":
        return "Khẩn";
      default:
        return p;
    }
  };

  const renderIcon = (p: string) => {
    switch (p) {
      case "LOW":
      case "Thấp":
        return <ArrowDown className="h-3 w-3 text-muted-foreground" />;
      case "MEDIUM":
      case "Trung bình":
        return <ArrowRight className="h-3 w-3 text-muted-foreground" />;
      case "HIGH":
      case "Cao":
        return <ArrowUp className="h-3 w-3 text-warning-foreground" />;
      case "URGENT":
      case "Khẩn":
        return <AlertCircle className="h-3 w-3 text-destructive-foreground animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <Badge
      variant={variant}
      className={cn("gap-1 font-normal text-[11px] py-0 px-2", className)}
    >
      {showIcon && renderIcon(priority)}
      <span>{getLabel(priority)}</span>
    </Badge>
  );
}
