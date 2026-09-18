"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  ListTodo,
  CalendarRange,
  Grid2X2,
  Users2,
  Award,
  Sparkles,
  Scale,
  Building2,
  Settings,
  Bell,
  Search,
  Bot,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "./UserAvatar";
import { AIAssistantDrawer } from "./AIAssistantDrawer";
import { CURRENT_WORKSPACE, CURRENT_PROJECT, MEMBERS } from "@/mocks/members";
import { MOCK_NOTIFICATIONS } from "@/mocks/notifications";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);
  const [notifications, setNotifications] = React.useState(MOCK_NOTIFICATIONS);

  const currentUser = MEMBERS[0]; // Lan (PM)
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Auto-collapse sidebar below 1024px
  React.useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard shortcuts: ⌘K for search, ⌘J for AI Assistant
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        router.push("/projects/ST/assistant");
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [router]);

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

  const navItems = [
    {
      title: "Dashboard",
      href: "/projects/ST/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Bảng Kanban",
      href: "/projects/ST/board",
      icon: Kanban,
      badge: "WIP 4/3",
      badgeVariant: "warning" as const,
    },
    {
      title: "Danh sách task",
      href: "/projects/ST/tasks",
      icon: ListTodo,
    },
    {
      title: "Gantt / Timeline",
      href: "/projects/ST/timeline",
      icon: CalendarRange,
    },
    {
      title: "Ma trận Eisenhower",
      href: "/projects/ST/eisenhower",
      icon: Grid2X2,
    },
    {
      title: "Tải nhân sự (Workload)",
      href: "/projects/ST/workload",
      icon: Users2,
      badge: "1 Quá tải",
      badgeVariant: "destructive" as const,
    },
    {
      title: "Ma trận kỹ năng",
      href: "/projects/ST/skills",
      icon: Award,
    },
    {
      title: "Trợ lý AI",
      href: "/projects/ST/assistant",
      icon: Bot,
      badge: "Chat & Nháp",
      badgeVariant: "info" as const,
    },
    {
      title: "Đề xuất cân bằng tải",
      href: "/projects/ST/rebalance",
      icon: Scale,
      badge: "Spread 41%",
      badgeVariant: "warning" as const,
    },
  ];

  const secondaryNavItems = [
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
    },
  ];

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("Đã đánh dấu tất cả thông báo là đã đọc");
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
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
                router.push("/projects/ST/assistant");
              }}
              className="cursor-pointer"
            >
              <Bot className="mr-2 h-4 w-4 text-info" />
              <span>Mở Trợ lý AI SmartTask (⌘J)</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push("/projects/ST/assistant");
                setCommandOpen(false);
              }}
              className="cursor-pointer"
            >
              <Sparkles className="mr-2 h-4 w-4 text-info" />
              <span>Phân rã yêu cầu thành WBS bằng AI</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.push("/projects/ST/rebalance");
                setCommandOpen(false);
              }}
              className="cursor-pointer"
            >
              <Scale className="mr-2 h-4 w-4 text-warning" />
              <span>Xem đề xuất cân bằng tải tự động</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Sidebar */}
      <aside
        className={cn(
          "relative z-30 flex flex-col border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Workspace Brand / Header */}
        <div className="flex h-14 items-center justify-between px-3 border-b border-border/60">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
                ST
              </div>
              <div className="flex flex-col truncate">
                <span className="font-semibold text-xs tracking-tight text-foreground truncate">
                  {CURRENT_WORKSPACE.name}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {CURRENT_PROJECT.name} ({CURRENT_PROJECT.key})
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              ST
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 hidden lg:flex"
            aria-label={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation links */}
        <ScrollArea className="flex-1 px-2 py-3">
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Dự án Agile
              </p>
            )}

            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors group cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      sidebarCollapsed && "justify-center px-2"
                    )}
                    title={sidebarCollapsed ? item.title : undefined}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate flex-1">{item.title}</span>
                    )}
                    {!sidebarCollapsed && item.badge && (
                      <Badge
                        variant={item.badgeVariant || "secondary"}
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4 font-mono",
                          isActive && "bg-primary-foreground/20 text-primary-foreground border-transparent"
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="pt-4 mt-4 border-t border-border/40 space-y-1">
            {!sidebarCollapsed && (
              <p className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Hệ thống
              </p>
            )}

            {secondaryNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors group cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      sidebarCollapsed && "justify-center px-2"
                    )}
                    title={sidebarCollapsed ? item.title : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="truncate flex-1">{item.title}</span>
                    )}
                    {!sidebarCollapsed && item.badge && (
                      <Badge
                        variant={item.badgeVariant || "secondary"}
                        className="text-[10px] px-1.5 py-0 h-4 font-mono"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>

        {/* Sidebar Footer: AI Assistant button & User info */}
        <div className="p-2 border-t border-border/60 space-y-2 bg-card/80">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/projects/ST/assistant")}
            className={cn(
              "w-full justify-start gap-2 text-xs h-8 border-info/40 bg-info/5 hover:bg-info/10 text-info font-medium",
              sidebarCollapsed && "justify-center px-0"
            )}
          >
            <Bot className="h-4 w-4 shrink-0 text-info" />
            {!sidebarCollapsed && (
              <>
                <span className="truncate flex-1 text-left">Trợ lý AI</span>
                <kbd className="hidden sm:inline text-[9px] bg-background/80 border px-1 rounded font-mono">⌘J</kbd>
              </>
            )}
          </Button>

          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40",
              sidebarCollapsed && "justify-center px-0"
            )}
          >
            <UserAvatar
              name={currentUser.name}
              avatar={currentUser.avatar}
              role={currentUser.role}
              initials={currentUser.initials}
              isOnline={currentUser.isOnline}
              size="sm"
            />
            {!sidebarCollapsed && (
              <div className="flex flex-col truncate flex-1">
                <span className="text-xs font-medium text-foreground truncate">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {currentUser.role} · VNPT
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-md">
          {/* Left: Breadcrumbs / Project presence indicator */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 lg:hidden text-muted-foreground"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FolderKanban className="h-4 w-4 text-primary" />
                {CURRENT_PROJECT.name}
              </span>
              <ChevronRight className="h-3 w-3" />
              <Badge variant="outline" className="text-[10px] font-mono font-medium">
                {CURRENT_PROJECT.currentSprint}
              </Badge>
            </div>
          </div>

          {/* Right: Search, AI button, Notifications, Theme Toggle, User Presence */}
          <div className="flex items-center gap-2">
            {/* Quick ⌘K Search Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCommandOpen(true)}
              className="h-8 w-44 md:w-56 justify-between px-2.5 text-xs text-muted-foreground border-border/80 bg-muted/30"
            >
              <span className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                <span>Tìm kiếm...</span>
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

            {/* Current User Avatar */}
            <div className="pl-1 border-l border-border/60">
              <UserAvatar
                name={currentUser.name}
                avatar={currentUser.avatar}
                role={currentUser.role}
                initials={currentUser.initials}
                isOnline={currentUser.isOnline}
                workloadPercent={currentUser.utilization}
                size="sm"
              />
            </div>
          </div>
        </header>

        {/* Page Content Container: max-w-screen-2xl p-6 */}
        <main className="flex-1 w-full max-w-screen-2xl mx-auto p-6 space-y-6">
          {children}
        </main>
      </div>

      {/* Persistent AI Assistant Drawer */}
      <AIAssistantDrawer open={aiDrawerOpen} onOpenChange={setAiDrawerOpen} />
    </div>
  );
}
