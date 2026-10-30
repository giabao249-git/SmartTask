"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { api, describeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { InvitationPreview } from "@/lib/types";
import { toast } from "sonner";

const ERR_TEXT: Record<string, string> = {
  NOT_FOUND: "Lời mời không tồn tại hoặc đã bị thu hồi.",
  INVITATION_EXPIRED: "Lời mời đã hết hạn — nhờ quản trị workspace tạo lại.",
  INVITATION_USED: "Lời mời này đã được dùng.",
  FORBIDDEN: "Lời mời dành cho email khác — đăng nhập đúng tài khoản được mời.",
};

/** Nhận lời mời (UC-06): GET /invitations/:token (công khai) → POST /invitations/:token/accept (cần đăng nhập). */
export function InvitationView({ token }: { token: string }) {
  const router = useRouter();
  const auth = useAuth();
  const preview = useQuery({ queryKey: ["invitations", token], queryFn: () => api.get<InvitationPreview>(`/invitations/${token}`, undefined, { anonymous: true }) });
  const accept = useMutation({
    mutationFn: () => api.post<{ workspaceId: string; role: string }>(`/invitations/${token}/accept`, {}),
    onSuccess: async () => {
      await auth.refetchMe();
      toast.success(`Đã tham gia ${preview.data?.workspaceName ?? "workspace"}`);
      router.replace("/workspaces");
    },
    onError: (e) => {
      const { code, message } = describeError(e);
      toast.error(ERR_TEXT[code] ?? message, { description: code });
    },
  });

  return (
    <div className="max-w-lg mx-auto py-10">
      {preview.isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : preview.isError ? (
        <ErrorState code={describeError(preview.error).code} message={ERR_TEXT[describeError(preview.error).code] ?? describeError(preview.error).message} onRetry={() => preview.refetch()} />
      ) : (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-info" /> Lời mời tham gia {preview.data.workspaceName}
            </CardTitle>
            <CardDescription className="text-xs">
              {preview.data.inviter} mời bạn với vai{" "}
              <Badge variant="secondary" className="text-[10px]">
                {preview.data.role}
              </Badge>{" "}
              · hết hạn {preview.data.expiresAt.slice(0, 10)}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            {preview.data.email && <p>Dành riêng cho: {preview.data.email}</p>}
            {auth.user ? (
              <p>
                Bạn đang đăng nhập là <span className="font-medium text-foreground">{auth.user?.fullName}</span> ({auth.user?.email}).
              </p>
            ) : (
              <p className="text-amber-600 font-medium">
                Vui lòng{" "}
                <Link href={`/login?next=/invitations/${token}`} className="underline text-primary">
                  đăng nhập
                </Link>{" "}
                bằng tài khoản tương ứng để chấp nhận lời mời.
              </p>
            )}
          </CardContent>
          <CardFooter className="gap-2 justify-end">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => router.push(auth.user ? "/workspaces" : "/login")}>
              Để sau
            </Button>
            {auth.user ? (
              <Button size="sm" className="text-xs gap-1.5" disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Tham gia workspace
              </Button>
            ) : (
              <Button size="sm" className="text-xs gap-1.5" onClick={() => router.push(`/login?next=/invitations/${token}`)}>
                Đăng nhập để tham gia
              </Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
