import type { ReactNode } from "react";
export function EditorLayout({
  header,
  navbar,
  form,
  preview,
  showPreview = false,
  collapsed = false,
}: {
  header: ReactNode;
  navbar: ReactNode;
  form: ReactNode;
  preview: ReactNode;
  showPreview?: boolean;
  collapsed?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur">
        {header}
      </div>
      <div
        className={`mx-auto grid max-w-[1800px] gap-6 px-5 pb-24 pt-6 lg:px-6 lg:pb-8 ${collapsed ? "lg:grid-cols-[48px_minmax(300px,.9fr)_minmax(0,1.1fr)]" : "lg:grid-cols-[160px_minmax(300px,.9fr)_minmax(0,1.1fr)]"}`}
      >
        <aside
          className={`${showPreview ? "hidden" : "block"} lg:sticky lg:top-24 lg:block lg:self-start`}
        >
          {navbar}
        </aside>
        <main
          className={`min-w-0 ${showPreview ? "hidden lg:block" : "block"}`}
        >
          {form}
        </main>
        <section
          aria-label="简历预览"
          className={`min-w-0 ${showPreview ? "block" : "hidden lg:block"}`}
        >
          {preview}
        </section>
      </div>
    </div>
  );
}
