import { Eye, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreationCard } from "./creation-card";
import { PaperPreview } from "@/components/ui/paper-preview";
import type { ResumeData, StyleSettings } from "@/lib/api/types";
import { completeResume, DEFAULT_STYLE, TEMPLATES } from "@/lib/resume/model";

type TemplateId = NonNullable<StyleSettings["templateId"]>;

export function templateStyle(templateId: TemplateId): StyleSettings {
  return {
    ...DEFAULT_STYLE,
    templateId,
    accent: templateId === "timeline" ? "graphite" : "ink",
    margin: templateId === "compact" ? 32 : 40,
  };
}

/** Synthetic display content. Creation requests use only the chosen style. */
export function templateExample(templateId: TemplateId): ResumeData {
  return completeResume({
    profile: {
      fullName: "林知夏",
      headline: "前端开发工程师",
      email: "hello@example.com",
      location: "上海",
      website: "example.com",
    },
    styleSettings: templateStyle(templateId),
    sections: [
      {
        id: "example-summary",
        type: "summary",
        title: "个人简介",
        content:
          "专注于清晰、易用的数字产品，擅长将复杂需求转化为可靠的用户体验。关注工程质量、可访问性与团队协作。",
      },
      {
        id: "example-education",
        type: "education",
        title: "教育经历",
        items: [
          {
            id: "example-degree",
            title: "示例大学",
            subtitle: "计算机科学与技术",
            degree: "本科",
            startDate: "2018-09",
            endDate: "2022-06",
            description: "主修数据结构、计算机网络、数据库与软件工程。",
          },
        ],
      },
      {
        id: "example-skills",
        type: "skill",
        title: "专业技能",
        content:
          "熟悉 TypeScript、React 与现代 Web 开发，重视组件复用、性能优化与自动化验证。能够独立完成需求分析、界面开发和交付协作。",
      },
      {
        id: "example-experience",
        type: "experience",
        title: "工作经历",
        items: [
          {
            id: "example-job",
            title: "示例科技有限公司",
            subtitle: "前端开发工程师",
            startDate: "2022-07",
            current: true,
            description:
              "负责核心业务界面与共享组件，持续改进交互体验。与产品、设计及后端协作，完成从原型到上线的完整开发流程。",
          },
        ],
      },
      {
        id: "example-project",
        type: "project",
        title: "项目经历",
        items: [
          {
            id: "example-project-item",
            title: "内容管理工作台",
            subtitle: "核心开发",
            description:
              "构建结构清晰的内容编辑与预览工作流，完善保存反馈和异常恢复，帮助团队更高效地整理与发布内容。",
          },
        ],
      },
    ],
  });
}

export function TemplateGallery({
  onCreate,
  onPreview,
  onMarkdown,
}: {
  onCreate: (template: TemplateId, trigger: HTMLElement) => void;
  onPreview: (template: TemplateId, trigger: HTMLElement) => void;
  onMarkdown: (trigger: HTMLElement) => void;
}) {
  return (
    <div className="grid items-stretch gap-6 sm:grid-cols-2">
      <CreationCard
        title="Markdown 简历"
        description="粘贴或上传内容，校对后开始制作"
        icon={FileCode2}
        action="立即创建"
        onAction={onMarkdown}
        isNew
      />
      {TEMPLATES.map((template) => (
        <Card key={template.id} className="group overflow-hidden pt-0">
          <CardContent className="px-0">
            <div className="relative aspect-[.86] overflow-hidden bg-surface-subtle">
              <div className="pointer-events-none" aria-hidden inert>
                <PaperPreview cv={templateExample(template.id)} firstPageOnly />
              </div>
              <Button
                type="button"
                variant="secondary"
                aria-label={`预览${template.title}`}
                className="absolute inset-0 h-full w-full flex-col opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                onClick={(event) => onPreview(template.id, event.currentTarget)}
              >
                <Eye aria-hidden data-icon="inline-start" />
                点击预览
              </Button>
            </div>
          </CardContent>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {template.title}
            </CardTitle>
            <CardDescription>{template.detail}</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => onPreview(template.id, event.currentTarget)}
              aria-label={`查看${template.title}预览`}
            >
              预览
            </Button>
            <Button
              size="sm"
              onClick={(event) => onCreate(template.id, event.currentTarget)}
              aria-label={`使用${template.title}`}
            >
              使用模板
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
