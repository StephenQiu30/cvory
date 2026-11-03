"use client";
import {PageHeader} from "@/components/layout/content";
import {ThemeMenu} from "@/components/account/theme-menu";
export default function Appearance(){return <><PageHeader title="外观" description="选择浅色、深色或跟随系统。只改变管理界面，简历纸张与公开内容保留自身配色。"/><div className="flex min-h-11 items-center justify-between rounded-md bg-surface-subtle p-3 text-sm"><span>管理界面主题</span><ThemeMenu/></div></>;}
