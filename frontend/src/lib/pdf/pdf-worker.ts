import { createTypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import { loadFonts } from "@myriaddreamin/typst.ts/dist/esm/options.init.mjs";
import { resolveEffectiveStyle } from "@/lib/templates/presets";
import type { ResumeSnapshot } from "@/lib/contract/contract";
import { toTypst } from "./resume-typst";

export interface PdfAnchor {
  readonly key: string;
  readonly page: number;
  readonly y: number;
}

export type PdfFailure = "fonts" | "render";

export type PdfWorkerReply =
  | { readonly id: number; readonly data: ArrayBuffer; readonly anchors: readonly PdfAnchor[] }
  | { readonly id: number; readonly error: PdfFailure };

const compilerWasm = new URL("@myriaddreamin/typst-ts-web-compiler/wasm", import.meta.url);
const sansFonts = ["NotoSansCJKsc-Regular.otf", "NotoSansCJKsc-Bold.otf"];
const serifFonts = ["NotoSerifCJKsc-Regular.otf", "NotoSerifCJKsc-Bold.otf"];
let compiler: ReturnType<typeof createTypstCompiler> | undefined;
let includesSerif = false;
let nextJob = Promise.resolve();
let latestJobId = 0;
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<{ id: number; snapshot: ResumeSnapshot }>) => void) | null;
  postMessage: (message: PdfWorkerReply, transfer?: Transferable[]) => void;
};

class FontLoadError extends Error {}

const fetchFont: typeof fetch = async (input, init) => {
  const cache =
    typeof caches === "undefined"
      ? null
      : await caches.open("cvory-pdf-fonts-sans2.004-serif2.003").catch(() => null);
  const existing = await cache?.match(input as RequestInfo).catch(() => undefined);
  if (existing) return existing;
  const response = await fetch(input, init).catch(() => {
    throw new FontLoadError();
  });
  if (!response.ok) throw new FontLoadError();
  await cache?.put(input as RequestInfo, response.clone()).catch(() => undefined);
  return response;
};

async function getCompiler(serif: boolean) {
  if (!compiler || (serif && !includesSerif)) {
    const next = createTypstCompiler();
    const fonts = (serif ? [...sansFonts, ...serifFonts] : sansFonts).map(
      (font) => new URL(`/fonts/${font}`, self.location.origin).href
    );
    await next.init({
      getModule: () => compilerWasm,
      beforeBuild: [loadFonts(fonts, { assets: false, fetcher: fetchFont })],
    });
    compiler = next;
    includesSerif = serif;
  }
  return compiler;
}

scope.onmessage = ({ data: { id, snapshot } }) => {
  latestJobId = id;
  nextJob = nextJob.then(async () => {
    if (id !== latestJobId) return;
    try {
      const style = resolveEffectiveStyle(snapshot.templateId, snapshot.styleOverrides);
      const instance = await getCompiler(style.fontFamily === "serif");
      if (id !== latestJobId) return;
      const mainFilePath = "/resume.typ";
      instance.addSource(mainFilePath, toTypst(snapshot));
      const result = await instance.runWithWorld({ mainFilePath }, async (world) => {
        const bytes = (await world.pdf()).result;
        if (!bytes?.length) return null;
        const anchors: PdfAnchor[] = await world.query({
          selector: "<resume-anchor>",
          field: "value",
        });
        return { data: Uint8Array.from(bytes).buffer, anchors };
      });
      if (!result) {
        scope.postMessage({ id, error: "render" });
        return;
      }
      scope.postMessage({ id, ...result }, [result.data]);
    } catch (error) {
      scope.postMessage({ id, error: error instanceof FontLoadError ? "fonts" : "render" });
    }
  });
};
