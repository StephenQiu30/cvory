"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {NavigationMenu,NavigationMenuList,NavigationMenuItem,NavigationMenuLink} from "@/components/ui/navigation-menu";
export function Navbar(){const path=usePathname();return <NavigationMenu viewport={false}><NavigationMenuList><NavigationMenuItem><NavigationMenuLink asChild active={path==="/"}><Link href="/" aria-current={path==="/"?"page":undefined} className={`rounded-full px-3.5 py-1.5 text-[11px] font-medium tracking-[0.88px] uppercase hover:bg-surface-subtle ${path==="/"?"bg-surface-subtle":""}`}>我的简历</Link></NavigationMenuLink></NavigationMenuItem></NavigationMenuList></NavigationMenu>;}
