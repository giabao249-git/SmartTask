"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingHeader } from "./LandingHeader";
import { LandingHero } from "./LandingHero";
import { LandingInteractiveDemo } from "./LandingInteractiveDemo";
import { LandingHowItWorks } from "./LandingHowItWorks";
import { LandingBentoFeatures } from "./LandingBentoFeatures";
import { LandingCostComparison } from "./LandingCostComparison";
import { LandingFaq } from "./LandingFaq";
import { LandingFooter } from "./LandingFooter";

interface LandingPageViewProps {
  isAuthenticated?: boolean;
  userFullName?: string | null;
  workspaceName?: string | null;
}

export function LandingPageView({
  isAuthenticated = false,
  userFullName,
  workspaceName,
}: LandingPageViewProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Smart Welcome Banner for Authenticated Users */}
      {isAuthenticated && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-center text-xs text-primary font-medium flex items-center justify-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>
            Chào mừng trở lại{userFullName ? `, ${userFullName}` : ""}! Bạn đang đăng nhập
            {workspaceName ? ` vào ${workspaceName}` : ""}.
          </span>
          <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs font-bold text-primary underline">
            <Link href="/workspaces">
              <span>Vào Không gian làm việc</span>
              <ArrowRight className="ml-1 h-3 w-3 inline" />
            </Link>
          </Button>
        </div>
      )}

      {/* Navigation Header */}
      <LandingHeader isAuthenticated={isAuthenticated} />

      {/* Main Content Sections */}
      <main className="flex-1">
        <LandingHero isAuthenticated={isAuthenticated} />
        <LandingInteractiveDemo />
        <LandingHowItWorks />
        <LandingBentoFeatures />
        <LandingCostComparison />
        <LandingFaq />
      </main>

      {/* Footer */}
      <LandingFooter isAuthenticated={isAuthenticated} />
    </div>
  );
}
