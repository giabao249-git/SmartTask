"use client";

import * as React from "react";
import Link from "next/link";
import { Sun, Moon, ArrowRight, Menu, X, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LandingHeaderProps {
  isAuthenticated?: boolean;
}

export function LandingHeader({ isAuthenticated }: LandingHeaderProps) {
  const [isDark, setIsDark] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

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

  const navLinks = [
    { label: "Tính năng cốt lõi", href: "#features" },
    { label: "Mô hình BYOK", href: "#how-it-works" },
    { label: "Trải nghiệm Sandbox", href: "#sandbox" },
    { label: "So sánh chi phí", href: "#cost-comparison" },
    { label: "Bảo mật & FAQ", href: "#faq" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-md transition-colors">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo & Brand Badge */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-sm transition-transform group-hover:scale-105">
              ST
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-foreground">
                SmartTask
              </span>
            </div>
          </Link>
          <Badge
            variant="outline"
            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5"
          >
            <Shield className="h-3 w-3" />
            100% BYOK · Free Agile
          </Badge>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
            title={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {isAuthenticated ? (
            <Button asChild size="sm" className="font-semibold shadow-sm">
              <Link href="/workspaces">
                <span>Vào Workspace của bạn</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-xs font-semibold">
                <Link href="/login">Đăng nhập</Link>
              </Button>
              <Button asChild size="sm" className="font-semibold text-xs shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/login?mode=register">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  <span>Bắt đầu ngay (Miễn phí)</span>
                </Link>
              </Button>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9 text-muted-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-border/60 bg-background/95 backdrop-blur-md px-4 py-4 space-y-3">
          <div className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="pt-2 border-t border-border/40 flex flex-col gap-2">
            {isAuthenticated ? (
              <Button asChild className="w-full">
                <Link href="/workspaces">Vào Workspace của bạn</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" className="w-full justify-center">
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button asChild className="w-full justify-center">
                  <Link href="/login?mode=register">Bắt đầu ngay (Miễn phí)</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
