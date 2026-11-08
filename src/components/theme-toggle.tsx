"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  if (!mounted) return <Button type="button" variant="ghost" size="icon" className={className} disabled aria-hidden suppressHydrationWarning><Sun aria-hidden /></Button>;

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Ganti ke light mode" : "Ganti ke dark mode"}
      aria-label={isDark ? "Ganti ke light mode" : "Ganti ke dark mode"}
    >
      {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
