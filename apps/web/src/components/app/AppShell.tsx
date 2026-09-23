"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Kanban,
  Settings2,
  Users2,
  Sparkles,
  Scale,
  Building2,
  Settings,
  Bell,
  Search,
  Bot,
  Sun,
  Moon,
  PanelLeft,
  Pin,
  ChevronRight,
  FolderKanban,
  Keyboard,
  LogOut,
  Check,
  ChevronsUpDown,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { ShortcutsDialog } from "@/components/app/ShortcutsDialog";
import { PlatformBanner } from "@/components/app/PlatformBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "./UserAvatar";
import { MOCK_NOTIFICATIONS } from "@/mocks/notifications";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { readLastProject } from "@/lib/hooks/use-project";
import { useProject } from "@/lib/hooks/queries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Zen / Arc Sidebar State
  const [isPinned, setIsPinned] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const leaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const [commandOpen, setCommandOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);
  const [notifications, setNotifications] = React.useState(MOCK_NOTIFICATIONS);
  const auth = useAuth();

  // Read pinned state from localStorage on client
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("st.sidebar.pinned");
      if (saved === "true") {
        setIsPinned(true);
      }
    } catch {}
  }, []);

  const togglePin = React.useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("st.sidebar.pinned", String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleMouseEnter = React.useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  }, []);

  const handleFocus = React.useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 200);
    }
  }, []);

  const routeProjectId = /^\/projects\/([0-9a-f-]{36})/i.exec(pathname)?.[1];
  const projectCtx = useProject(routeProjectId).data ?? null;
  const [lastProject, setLastProject] = React.useState<{ id: string; key: string; name: string } | null>(null);
  React.useEffect(() => setLastProject(readLastProject()), [projectCtx?.id]);

  const project = projectCtx ?? lastProject;
  const projectBase = project ? `/projects/${project.id}` : null;
  const currentUser = auth.user;
  const workspace = projectCtx
    ? auth.workspaces.find((w) => w.id === projectCtx.workspaceId) ?? auth.workspaces[0]
    : auth.workspaces[0];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const isAssistantPage = pathname.includes("/assistant");

  // Keyboard shortcuts: ⌘K for search, ⌘J for AI Assistant, ⌘B for Pin/Unpin, ? for shortcuts
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "j" && projectBase) {
        e.preventDefault();
        router.push(`${projectBase}/assistant`);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        togglePin();
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable;
      if (!isInput && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [router, projectBase, togglePin]);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      setIsDark(true);
    }
  };

  const navItems = React.useMemo(
    () =>
      projectBase
        ? [
            {
              title: "Dashboard",
              href: `${projectBase}/dashboard`,
              icon: LayoutDashboard,
            },
            {
              title: "Công việc",
              href: `${projectBase}/work`,
              icon: Kanban,
              badge: "4 cách xem",
              badgeVariant: "secondary" as const,
            },
            {
              title: "Nhân sự & kỹ năng",
              href: `${projectBase}/people`,
              icon: Users2,
            },
            {
              title: "Trợ lý AI",
              href: `${projectBase}/assistant`,
              icon: Bot,
              badge: "Chat & Nháp",
              badgeVariant: "info" as const,
              dotColor: "bg-info",
            },
            {
              title: "Cấu hình dự án",
              href: `${projectBase}/settings`,
              icon: Settings2,
            },
          ]
        : [],
    [projectBase]
  );

  const secondaryNavItems = React.useMemo(
    () => [
      {
        title: "Danh sách Workspace & Dự án",
        href: "/workspaces",
        icon: Building2,
      },
      {
        title: "Thông báo & Cài đặt",
        href: "/settings",
        icon: Settings,
        badge: unreadCount > 0 ? `${unreadCount}` : undefined,
        badgeVariant: "destructive" as const,
        dotColor: unreadCount > 0 ? "bg-destructive" : undefined,
      },
      ...(currentUser?.isSuperAdmin
        ? [
            {
              title: "Quản trị Nền tảng (Platform)",
              href: "/admin",
              icon: ShieldAlert,
              badge: "Admin",
              badgeVariant: "default" as const,
              dotColor: "bg-indigo-500",
            },
          ]
        : []),
    ],
    [unreadCount, currentUser?.isSuperAdmin]
  );

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("Đã đánh dấu tất cả thông báo là đã đọc");
  };

  const isExpanded = isPinned || isHovered;

  const renderNavList = (expanded: boolean, onNavigate?: () => void) => (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-1">
        {expanded && (
          <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Dự án Agile
          </p>
        )}

        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const link = (
            <Link key={item.href} href={item.href} onClick={onNavigate} className="block">
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors group cursor-pointer relative",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  !expanded && "justify-center px-0 h-9 w-9 mx-auto"
                )}
              >
                <div className="relative flex items-center justify-center">
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {!expanded && item.dotColor && (
                    <span className={cn("absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-card", item.dotColor)} />
                  )}
                </div>
                {expanded && (
                  <>
                    <span className="truncate flex-1">{item.title}</span>
                    {item.badge && (
                      <Badge
                        variant={item.badgeVariant || "secondary"}
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4 font-mono shrink-0",
                          isActive && "bg-primary-foreground/20 text-primary-foreground border-transparent"
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </Link>
          );

          if (!expanded) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-1.5 text-xs font-medium">
                  <span>{item.title}</span>
                  {item.badge && (
                    <Badge variant={item.badgeVariant || "secondary"} className="text-[9px] px-1 py-0 font-mono">
                      {item.badge}
                    </Badge>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </div>

      <div className="pt-4 mt-4 border-t border-border/40 space-y-1">
        {expanded && (
          <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Hệ thống
          </p>
        )}

        {secondaryNavItems.map((item) => {
          const isActive = pathname === item.href;
          const link = (
            <Link key={item.href} href={item.href} onClick={onNavigate} className="block">
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors group cursor-pointer relative",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  !expanded && "justify-center px-0 h-9 w-9 mx-auto"
                )}
              >
                <div className="relative flex items-center justify-center">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!expanded && item.dotColor && (
                    <span className={cn("absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-card", item.dotColor)} />
                  )}
                </div>
                {expanded && (
                  <>
                    <span className="truncate flex-1">{item.title}</span>
                    {item.badge && (
                      <Badge
                        variant={item.badgeVariant || "secondary"}
                        className="text-[10px] px-1.5 py-0 h-4 font-mono shrink-0"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </Link>
          );

          if (!expanded) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-1.5 text-xs font-medium">
                  <span>{item.title}</span>
                  {item.badge && (
                    <Badge variant={item.badgeVariant || "secondary"} className="text-[9px] px-1 py-0 font-mono">
                      {item.badge}
                    </Badge>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </div>
    </TooltipProvider>
  );

  return (
    <div
      className={cn(
        "flex min-h-screen w-full bg-background text-foreground transition-[padding] duration-200",
        isPinned ? "md:pl-[260px]" : "md:pl-14"
      )}
    >
      {/* ⌘K Command Palette Dialog */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Tìm kiếm nhanh công việc, thành viên, điều hướng (⌘K)..." />
        <CommandList>
          <CommandEmpty>Không tìm thấy kết quả phù hợp</CommandEmpty>
          <CommandGroup heading="Điều hướng nhanh">
            {navItems.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  router.push(item.href);
                  setCommandOpen(false);
                }}
                className="cursor-pointer"
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Thao tác AI">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                if (projectBase) router.push(`${projectBase}/assistant`);
              }}
              className="cursor-pointer"
            >
              <Bot className="mr-2 h-4 w-4 text-info" />
              <span>Mở Trợ lý AI SmartTask (⌘J)</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                if (projectBase) router.push(`${projectBase}/assistant`);
                setCommandOpen(false);
              }}
              className="cursor-pointer"
            >
              <Sparkles className="mr-2 h-4 w-4 text-info" />
              <span>Phân rã yêu cầu thành WBS bằng AI</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                if (projectBase) router.push(`${projectBase}/people?tab=balance`);
                setCommandOpen(false);
              }}
              className="cursor-pointer"
            >
              <Scale className="mr-2 h-4 w-4 text-warning" />
              <span>Xem đề xuất cân bằng tải tự động</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Trợ giúp & Phím tắt">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                setShortcutsOpen(true);
              }}
              className="cursor-pointer"
            >
              <Keyboard className="mr-2 h-4 w-4 text-primary" />
              <span>Bảng tra cứu phím tắt (?)</span>
              <kbd className="ml-auto text-[10px] font-mono bg-background border px-1 rounded">?</kbd>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Desktop Zen/Arc Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 hidden md:flex flex-col border-r border-border bg-card/95 backdrop-blur-md transition-all duration-150 ease-out",
          isExpanded ? "w-[260px] shadow-2xl" : "w-14 shadow-none"
        )}
      >
        {/* Workspace Brand / Header */}
        <div
          className={cn(
            "flex h-14 items-center px-3 border-b border-border/60 shrink-0",
            isExpanded ? "justify-between" : "justify-center px-0"
          )}
        >
          {isExpanded ? (
            <>
              <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs shrink-0">
                  ST
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-semibold text-xs tracking-tight text-foreground truncate">
                    {workspace?.name ?? "SmartTask"}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {project ? `${project.name} (${project.key})` : "Chưa chọn dự án"}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePin}
                className={cn(
                  "h-7 w-7 text-muted-foreground hover:text-foreground shrink-0",
                  isPinned && "text-primary hover:text-primary"
                )}
                aria-label={isPinned ? "Bỏ ghim sidebar (⌘B)" : "Ghim sidebar (⌘B)"}
                title={isPinned ? "Bỏ ghim sidebar (⌘B)" : "Ghim sidebar (⌘B)"}
              >
                <Pin className={cn("h-4 w-4 transition-transform", isPinned ? "rotate-45 fill-current text-primary" : "rotate-0")} />
              </Button>
            </>
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs"
              title={workspace?.name ?? "SmartTask"}
            >
              ST
            </div>
          )}
        </div>

        {/* Navigation links */}
        <ScrollArea className="flex-1 px-2 py-3 overflow-hidden">
          {renderNavList(isExpanded)}
        </ScrollArea>

        {/* Sidebar Footer: AI Assistant button & User info */}
        <div className="p-2 border-t border-border/60 space-y-2 bg-card/80 shrink-0">
          <TooltipProvider delayDuration={150}>
            {isExpanded ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => projectBase && router.push(`${projectBase}/assistant`)}
                disabled={!projectBase}
                className="w-full justify-start gap-2 text-xs h-8 border-info/40 bg-info/5 hover:bg-info/10 text-info font-medium"
              >
                <Bot className="h-4 w-4 shrink-0 text-info" />
                <span className="truncate flex-1 text-left">Trợ lý AI</span>
                <kbd className="hidden sm:inline text-[9px] bg-background/80 border px-1 rounded font-mono">⌘J</kbd>
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => projectBase && router.push(`${projectBase}/assistant`)}
                    disabled={!projectBase}
                    className="h-9 w-9 mx-auto flex items-center justify-center border-info/40 bg-info/5 hover:bg-info/10 text-info"
                  >
                    <Bot className="h-4 w-4 text-info" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Trợ lý AI (⌘J)</TooltipContent>
              </Tooltip>
            )}

            {isExpanded ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40">
                <UserAvatar
                  name={currentUser?.fullName ?? "?"}
                  avatar={currentUser?.avatarUrl ?? undefined}
                  role={workspace?.role}
                  isOnline
                  size="sm"
                  showTooltip={false}
                />
                <div className="flex flex-col truncate flex-1">
                  <span className="text-xs font-medium text-foreground truncate">
                    {currentUser?.fullName}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {projectCtx?.myRole ?? workspace?.role ?? ""}{workspace ? ` · ${workspace.name}` : ""}
                  </span>
                </div>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-center p-1 cursor-pointer">
                    <UserAvatar
                      name={currentUser?.fullName ?? "?"}
                      avatar={currentUser?.avatarUrl ?? undefined}
                      role={workspace?.role}
                      isOnline
                      size="sm"
                      showTooltip={false}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-xs font-semibold">{currentUser?.fullName}</div>
                  <div className="text-[10px] text-muted-foreground">{workspace?.role ?? "Thành viên"}</div>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar (< 768px) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] p-0 flex flex-col">
          <SheetHeader className="h-14 px-3 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs shrink-0">
                ST
              </div>
              <div className="flex flex-col truncate">
                <SheetTitle className="font-semibold text-xs tracking-tight text-foreground truncate text-left">
                  {workspace?.name ?? "SmartTask"}
                </SheetTitle>
                <SheetDescription className="text-[10px] text-muted-foreground truncate text-left">
                  {project ? `${project.name} (${project.key})` : "Chưa chọn dự án"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-2 py-3">
            {renderNavList(true, () => setMobileOpen(false))}
          </ScrollArea>

          <div className="p-2 border-t border-border/60 space-y-2 bg-card/80 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMobileOpen(false);
                if (projectBase) router.push(`${projectBase}/assistant`);
              }}
              disabled={!projectBase}
              className="w-full justify-start gap-2 text-xs h-8 border-info/40 bg-info/5 hover:bg-info/10 text-info font-medium"
            >
              <Bot className="h-4 w-4 shrink-0 text-info" />
              <span className="truncate flex-1 text-left">Trợ lý AI</span>
            </Button>

            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40">
              <UserAvatar
                name={currentUser?.fullName ?? "?"}
                avatar={currentUser?.avatarUrl ?? undefined}
                role={workspace?.role}
                isOnline
                size="sm"
                showTooltip={false}
              />
              <div className="flex flex-col truncate flex-1">
                <span className="text-xs font-medium text-foreground truncate">
                  {currentUser?.fullName}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {projectCtx?.myRole ?? workspace?.role ?? ""}{workspace ? ` · ${workspace.name}` : ""}
                </span>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 min-h-screen">
        {/* Top Navbar — Fixed/Sticky at top with backdrop blur */}
        <header className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 sm:px-6 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-xs">
          {/* Left: Hamburger (mobile) + Workspace Switcher + Project Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="h-8 w-8 md:hidden text-muted-foreground shrink-0"
              aria-label="Mở menu điều hướng"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>

            {/* Workspace Switcher */}
            <WorkspaceSwitcher />

            <span className="text-border text-sm font-light select-none hidden sm:inline">/</span>

            {/* Project Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 truncate">
              <Link
                href={projectBase ? `${projectBase}/work` : "/workspaces"}
                className="font-semibold text-foreground/90 hover:text-foreground flex items-center gap-1.5 hover:underline truncate"
              >
                <FolderKanban className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate max-w-[100px] sm:max-w-[160px] md:max-w-[200px]">
                  {projectCtx ? projectCtx.name : "Dự án"}
                </span>
              </Link>
              {projectCtx && (
                <>
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60 hidden sm:inline" />
                  <Badge variant="outline" className="text-[10px] font-mono font-medium truncate max-w-[130px] sm:max-w-none hidden sm:inline-flex">
                    {projectCtx.activeSprint
                      ? `${projectCtx.activeSprint.name}`
                      : "Chưa có sprint"}
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* Right: Search, Notifications, Theme Toggle, User Presence */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick ⌘K Search Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCommandOpen(true)}
              className="h-8 w-32 sm:w-44 md:w-56 justify-between px-2.5 text-xs text-muted-foreground border-border/80 bg-muted/30"
            >
              <span className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tìm kiếm...</span>
              </span>
              <kbd className="text-[10px] font-mono bg-background border px-1 rounded">⌘K</kbd>
            </Button>

            {/* Notification Bell with Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Thông báo"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b border-border/60 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Trung tâm thông báo</h4>
                    <p className="text-[10px] text-muted-foreground">
                      {unreadCount} thông báo mới chưa đọc
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllNotificationsRead}
                      className="h-6 text-[10px] text-primary hover:text-primary/80 px-1.5"
                    >
                      Đọc tất cả
                    </Button>
                  )}
                </div>
                <ScrollArea className="max-h-[320px]">
                  <div className="divide-y divide-border/40">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "p-3 text-xs space-y-1 transition-colors hover:bg-muted/50 cursor-pointer",
                          !n.read && "bg-primary/5"
                        )}
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                          );
                          if (n.linkUrl) router.push(n.linkUrl);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn("font-medium", !n.read ? "text-foreground" : "text-muted-foreground")}>
                            {n.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{n.timestamp}</span>
                        </div>
                        <p className="text-muted-foreground line-clamp-2 text-[11px] leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-2 border-t border-border/60 text-center bg-muted/20">
                  <Link
                    href="/settings"
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Xem tất cả trong Cài đặt thông báo →
                  </Link>
                </div>
              </PopoverContent>
            </Popover>

            {/* Bảng phím tắt (?) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShortcutsOpen(true)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Bảng phím tắt (?)"
              title="Bảng phím tắt (?)"
            >
              <Keyboard className="h-4 w-4" />
            </Button>

            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Chuyển đổi giao diện sáng/tối"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Current User menu */}
            <div className="pl-1 border-l border-border/60">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Tài khoản">
                    <UserAvatar name={currentUser?.fullName ?? "?"} avatar={currentUser?.avatarUrl ?? undefined} role={workspace?.role} isOnline size="sm" showTooltip={false} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs">
                    <div className="font-semibold truncate">{currentUser?.fullName}</div>
                    <div className="text-[10px] text-muted-foreground font-normal truncate">{currentUser?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push("/workspaces")} className="text-xs">
                    <Building2 className="mr-2 h-4 w-4" /> Workspace & dự án
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/settings")} className="text-xs">
                    <Settings className="mr-2 h-4 w-4" /> Cài đặt
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      void auth.logout().then(() => router.replace("/login"));
                    }}
                    className="text-xs text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <PlatformBanner />

        {/* Page Content Container: max-w-screen-2xl p-6 */}
        <main className={cn("flex-1 w-full max-w-screen-2xl mx-auto p-4 sm:p-6 space-y-6", isAssistantPage && "space-y-0")}>
          {children}
        </main>
      </div>

      {/* Global Shortcuts Dialog */}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

function _fmtRange(a: string, b: string): string {
  const f = (d: string) => {
    const x = new Date(d);
    return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  return `${f(a)}–${f(b)}`;
}

export interface WorkspaceSwitcherProps {
  onWorkspaceChange?: (workspaceId: string) => void;
  className?: string;
}

export function WorkspaceSwitcher({ onWorkspaceChange, className }: WorkspaceSwitcherProps) {
  const auth = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = usePathname();
  const routeProjectId = /^\/projects\/([0-9a-f-]{36})/i.exec(pathname)?.[1];
  const projectCtx = useProject(routeProjectId).data ?? null;

  const [activeWsId, setActiveWsId] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("st.lastWorkspace");
      if (saved && auth.workspaces.some((w) => w.id === saved)) {
        setActiveWsId(saved);
        return;
      }
    } catch {}
    if (projectCtx?.workspaceId) {
      setActiveWsId(projectCtx.workspaceId);
    } else if (auth.workspaces.length > 0) {
      setActiveWsId(auth.workspaces[0].id);
    }
  }, [auth.workspaces, projectCtx?.workspaceId]);

  const currentWorkspace =
    auth.workspaces.find((w) => w.id === (projectCtx?.workspaceId ?? activeWsId)) ??
    auth.workspaces.find((w) => w.id === activeWsId) ??
    auth.workspaces[0] ??
    null;

  const handleSelect = React.useCallback(
    async (targetWorkspaceId: string) => {
      setActiveWsId(targetWorkspaceId);
      try {
        localStorage.setItem("st.lastWorkspace", targetWorkspaceId);
      } catch {}

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("st:workspace-changed", { detail: { workspaceId: targetWorkspaceId } })
        );
      }

      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      await qc.invalidateQueries({ queryKey: ["projects"] });

      onWorkspaceChange?.(targetWorkspaceId);

      const targetWs = auth.workspaces.find((w) => w.id === targetWorkspaceId);
      toast.success(`Đã chọn workspace: ${targetWs?.name ?? targetWorkspaceId}`);

      if (projectCtx && projectCtx.workspaceId !== targetWorkspaceId) {
        router.push("/workspaces");
      } else if (pathname.startsWith("/settings")) {
        router.push(`/settings?ws=${targetWorkspaceId}`);
      }
    },
    [auth.workspaces, onWorkspaceChange, pathname, projectCtx, qc, router]
  );

  if (auth.workspaces.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2 gap-1.5 text-xs hover:bg-muted/80 focus-visible:ring-1 max-w-[170px] sm:max-w-[210px] justify-between border border-border/50 bg-background/60",
            className
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary font-bold text-[10px] border border-primary/25">
              {currentWorkspace?.name ? currentWorkspace.name.slice(0, 2).toUpperCase() : "ST"}
            </div>
            <span className="truncate font-semibold text-foreground text-xs">
              {currentWorkspace?.name ?? "Chọn workspace"}
            </span>
            {currentWorkspace?.role && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] px-1 py-0 font-medium shrink-0 hidden lg:inline-flex",
                  currentWorkspace.role === "OWNER" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                  currentWorkspace.role === "ADMIN" && "bg-primary/10 text-primary border-primary/30",
                  currentWorkspace.role === "MEMBER" && "text-muted-foreground"
                )}
              >
                {currentWorkspace.role}
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0 ml-0.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1 text-xs shadow-lg">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
          Không gian làm việc ({auth.workspaces.length})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5">
          {auth.workspaces.map((w) => {
            const isSelected = w.id === currentWorkspace?.id;
            return (
              <DropdownMenuItem
                key={w.id}
                onClick={() => handleSelect(w.id)}
                className={cn(
                  "flex items-center justify-between px-2 py-2 rounded-md cursor-pointer gap-2",
                  isSelected && "bg-primary/10 font-medium text-foreground"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground font-semibold text-[10px] border border-border/80">
                    {w.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col truncate text-left">
                    <span className="truncate text-xs font-medium">{w.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{w.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                    {w.role}
                  </Badge>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push(`/settings?ws=${currentWorkspace?.id}`)}
          className="gap-2 cursor-pointer text-xs"
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Cài đặt Workspace</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/workspaces")}
          className="gap-2 cursor-pointer text-xs text-primary focus:text-primary font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Quản lý & Tạo workspace mới</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
