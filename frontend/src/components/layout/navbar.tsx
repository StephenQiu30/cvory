"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";

export function Navbar() {
  const path = usePathname();
  const links = [
    {
      href: "/workspace",
      label: "我的简历",
      active: path.startsWith("/workspace"),
    },
    { href: "/workspace#resume-templates", label: "简历模板", active: false },
    {
      href: "/settings/publication",
      label: "公开展示",
      active: path === "/settings/publication",
    },
    {
      href: "/delivery",
      label: "求职准备",
      active: path.startsWith("/delivery"),
    },
  ];

  return (
    <NavigationMenu viewport={false} className="hidden sm:flex">
      <NavigationMenuList className="gap-3 lg:gap-6">
        {links.map(({ href, label, active }) => (
          <NavigationMenuItem key={href}>
            <NavigationMenuLink asChild active={active}>
              <Link href={href} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
