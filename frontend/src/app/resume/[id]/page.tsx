import { ResumeEditorWorkspace } from "@/components/editor/resume-editor-workspace";

interface ResumeEditorPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function ResumeEditorPage({ params }: ResumeEditorPageProps) {
  const { id } = await params;
  return <ResumeEditorWorkspace docId={id} />;
}
