"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { markAllReadAction } from "@/app/protected/notifications/actions";
import { useToast } from "@/lib/utils/toast-notification";

export function MarkAllReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const handleClick = () => {
    startTransition(async () => {
      const result = await markAllReadAction();
      if (!result.success) {
        toast.error(result.error ?? "Failed to mark all notifications as read.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={isPending}>
      Mark all read
    </Button>
  );
}
