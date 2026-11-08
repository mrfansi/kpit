"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      size="default"
      className="w-full justify-start gap-2.5 px-2.5 font-normal text-muted-foreground hover:text-foreground has-[>svg]:px-2.5"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut aria-hidden className="size-4" />
      Keluar
    </Button>
  );
}
