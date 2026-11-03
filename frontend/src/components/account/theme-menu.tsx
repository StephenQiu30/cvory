"use client";
import { useEffect, useState } from "react";
import { Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
export function ThemeMenu() {
  const [theme, setTheme] = useState("system");
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const saved = localStorage.getItem("cvory.theme.v1") || "system";
    const apply = (mode: string) =>
      document.documentElement.classList.toggle(
        "dark",
        mode === "dark" || (mode === "system" && mq.matches),
      );
    apply(saved);
    const update = () =>
      apply(localStorage.getItem("cvory.theme.v1") || "system");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  function change(v: string) {
    setTheme(v);
    localStorage.setItem("cvory.theme.v1", v);
    document.documentElement.classList.toggle(
      "dark",
      v === "dark" ||
        (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches),
    );
  }
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setTheme(localStorage.getItem("cvory.theme.v1") || "system");
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="切换外观">
          <Sun aria-hidden className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>外观</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={change}>
          {[
            ["light", "浅色"],
            ["dark", "深色"],
            ["system", "跟随系统"],
          ].map(([value, label]) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
