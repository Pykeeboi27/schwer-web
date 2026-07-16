"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut } from "lucide-react";

type UserMenuProps = {
  email: string;
  role?: string | null;
  department?: string | null;
};

function initialsFromEmail(email: string): string {
  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return initials.toUpperCase();
}

/** "sales_manager" → "Sales Manager" */
function formatLabel(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Top-nav account menu: initials avatar + username trigger, with the account
 * details and sign-out tucked into a dropdown so the nav's only loud element
 * stays the brand, not the logout button.
 */
export function UserMenu({ email, role, department }: UserMenuProps) {
  const router = useRouter();
  const username = email.split("@")[0] ?? email;
  const roleLabel = role
    ? formatLabel(role)
    : department
      ? formatLabel(department)
      : null;

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
          >
            {initialsFromEmail(email)}
          </span>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
            {username}
          </span>
          <ChevronDown className="hidden size-3.5 text-muted-foreground sm:inline" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate">{username}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          {roleLabel ? (
            <p className="mt-1 text-xs font-normal text-muted-foreground">{roleLabel}</p>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
