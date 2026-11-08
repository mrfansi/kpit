"use client";

import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      size="default"
      className="w-full justify-start gap-2.5 px-2.5 font-normal text-muted-foreground hover:text-foreground has-[>svg]:px-2.5"
      onClick={async () => {
        await signOut();
        window.location.href = "/login";
      }}
    >
      <LogOut aria-hidden className="size-4" />
      Keluar
    </Button>
  );
}
