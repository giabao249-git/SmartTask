import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface UserAvatarProps {
  name: string;
  avatar?: string;
  role?: string;
  initials?: string;
  isOnline?: boolean;
  size?: "sm" | "default" | "lg";
  showTooltip?: boolean;
  className?: string;
  workloadPercent?: number;
}

export function UserAvatar({
  name,
  avatar,
  role,
  initials,
  isOnline,
  size = "default",
  showTooltip = true,
  className,
  workloadPercent,
}: UserAvatarProps) {
  const sizeClasses = {
    sm: "h-6 w-6 text-[10px]",
    default: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };

  const computedInitials =
    initials ||
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const avatarElement = (
    <div className={cn("relative inline-block shrink-0", className)}>
      <Avatar className={cn(sizeClasses[size], "border border-background shadow-xs")}>
        {avatar && <AvatarImage src={avatar} alt={name} />}
        <AvatarFallback className="font-medium bg-muted text-foreground">
          {computedInitials}
        </AvatarFallback>
      </Avatar>

      {isOnline !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-background",
            size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
            isOnline ? "bg-success" : "bg-muted-foreground"
          )}
          aria-label={isOnline ? "Trực tuyến" : "Ngoại tuyến"}
        />
      )}
    </div>
  );

  if (!showTooltip) return avatarElement;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{avatarElement}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold">{name} {role ? `(${role})` : ""}</p>
        {workloadPercent !== undefined && (
          <p className="text-muted-foreground text-[10px]">Tải tuần: {workloadPercent}%</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
