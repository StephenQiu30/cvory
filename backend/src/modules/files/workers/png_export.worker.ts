import type * as PdfJs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createRequire} from 'node:module';
import {dirname, join, resolve, sep} from 'node:path';
import {
  PNG_EXPORT_MAX_BYTES,
  PNG_EXPORT_MAX_DIMENSION,
  PNG_EXPORT_MAX_PAGE_PIXELS,
  PNG_EXPORT_MAX_PAGES,
  PNG_EXPORT_MAX_TOTAL_PIXELS,
  PNG_EXPORT_SCALE,
} from '../png_export.constants';

const localRequire = createRequire(__filename);
const pdfjs = localRequire('pdfjs-dist/legacy/build/pdf.mjs') as typeof PdfJs;

type FailureReason = 'PNG_INVALID_FILE' | 'PNG_LIMIT_EXCEEDED' | 'PNG_RENDER_FAILED';
type PageSize = {width: number; height: number};
type RenderPage = PageSize & {pixels: number};
type ZipEntry = {name: Buffer; data: Buffer; checksum: number; offset: number};
type CanvasAndContext = {
  canvas: {toBuffer: (mimeType: 'image/png') => Uint8Array};
  context: NonNullable<Parameters<PdfJs.PDFPageProxy['render']>[0]['canvasContext']>;
};
type CanvasFactory = {
  create: (width: number, height: number) => CanvasAndContext;
  destroy: (canvasAndContext: CanvasAndContext) => void;
};
type PngResult = {
  data: Buffer;
  contentType: 'image/png' | 'application/zip';
  pageCount: number;
  pageSizes: PageSize[];
};

class WorkerFailure extends Error {
  constructor(readonly reason: FailureReason) {
    super(reason);
  }
}

const crcTable = Array.from({length: 256}, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCanvasFactory(value: unknown): value is CanvasFactory {
  return (
    isRecord(value) && typeof value.create === 'function' && typeof value.destroy === 'function'
  );
}

function checksum(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ (crcTable[(value ^ byte) & 0xff] as number);
  return (value ^ 0xffffffff) >>> 0;
}

function createZip(entries: ZipEntry[]): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const localHeader = Buffer.alloc(30 + entry.name.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x0021, 12);
    localHeader.writeUInt32LE(entry.checksum, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(entry.name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    entry.name.copy(localHeader, 30);
    entry.offset = offset;
    localChunks.push(localHeader, entry.data);
    offset += localHeader.length + entry.data.length;

    const centralHeader = Buffer.alloc(46 + entry.name.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x0021, 14);
    centralHeader.writeUInt32LE(entry.checksum, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(entry.name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(entry.offset, 42);
    entry.name.copy(centralHeader, 46);
    centralChunks.push(centralHeader);
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);
  const outputSize = offset + centralDirectory.length + endRecord.length;
  if (outputSize > PNG_EXPORT_MAX_BYTES) throw new WorkerFailure('PNG_LIMIT_EXCEEDED');
  return Buffer.concat([...localChunks, centralDirectory, endRecord], outputSize);
}

function pdfResources(): {
  cMapUrl: string;
  cMapPacked: true;
  standardFontDataUrl: string;
  wasmUrl: string;
} {
  const pdfRoot = resolve(
    dirname(localRequire.resolve('pdfjs-dist/legacy/build/pdf.mjs')),
    '../..',
  );
  return {
    cMapUrl: `${join(pdfRoot, 'cmaps')}${sep}`,
    cMapPacked: true,
    standardFontDataUrl: `${join(pdfRoot, 'standard_fonts')}${sep}`,
    wasmUrl: `${join(pdfRoot, 'wasm')}${sep}`,
  };
}

function pageSize(width: number, height: number): RenderPage {
  const pixelWidth = Math.ceil(width);
  const pixelHeight = Math.ceil(height);
  const pixels = pixelWidth * pixelHeight;
  if (
    !Number.isSafeInteger(pixelWidth) ||
    !Number.isSafeInteger(pixelHeight) ||
    pixelWidth < 1 ||
    pixelHeight < 1 ||
    pixelWidth > PNG_EXPORT_MAX_DIMENSION ||
    pixelHeight > PNG_EXPORT_MAX_DIMENSION ||
    pixels > PNG_EXPORT_MAX_PAGE_PIXELS
  )
    throw new WorkerFailure('PNG_LIMIT_EXCEEDED');
  return {width: pixelWidth, height: pixelHeight, pixels};
}

async function renderPdf(pdf: Uint8Array): Promise<PngResult> {
  const task = pdfjs.getDocument({data: pdf, ...pdfResources()});
  try {
    const document = await task.promise;
    if (document.numPages < 1 || document.numPages > PNG_EXPORT_MAX_PAGES)
      throw new WorkerFailure('PNG_LIMIT_EXCEEDED');

    let totalPixels = 0;
    const pages: RenderPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({scale: PNG_EXPORT_SCALE});
      const size = pageSize(viewport.width, viewport.height);
      page.cleanup();
      totalPixels += size.pixels;
      if (totalPixels > PNG_EXPORT_MAX_TOTAL_PIXELS) throw new WorkerFailure('PNG_LIMIT_EXCEEDED');
      pages.push(size);
    }

    if (!isCanvasFactory(document.canvasFactory)) throw new WorkerFailure('PNG_RENDER_FAILED');
    const canvasFactory = document.canvasFactory;
    const entries: ZipEntry[] = [];
    const pageSizes: PageSize[] = [];
    let totalBytes = 0;
    let singlePage: Buffer | undefined;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({scale: PNG_EXPORT_SCALE});
      const size = pages[pageNumber - 1];
      if (!size) throw new WorkerFailure('PNG_RENDER_FAILED');
      const canvas = canvasFactory.create(size.width, size.height);
      try {
        const render = page.render({canvas: null, canvasContext: canvas.context, viewport});
        await render.promise;
        const data = Buffer.from(canvas.canvas.toBuffer('image/png'));
        if (
          data.length < 8 ||
          !data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        )
          throw new WorkerFailure('PNG_RENDER_FAILED');
        totalBytes += data.length;
        if (totalBytes > PNG_EXPORT_MAX_BYTES) throw new WorkerFailure('PNG_LIMIT_EXCEEDED');
        pageSizes.push({width: size.width, height: size.height});
        if (document.numPages === 1) singlePage = data;
        else {
          const filename = `page-${String(pageNumber).padStart(2, '0')}.png`;
          entries.push({
            name: Buffer.from(filename, 'utf8'),
            data,
            checksum: checksum(data),
            offset: 0,
          });
        }
      } finally {
        canvasFactory.destroy(canvas);
        page.cleanup();
      }
    }

    const data =
      singlePage ?? (entries.length === document.numPages ? createZip(entries) : undefined);
    if (!data || data.length > PNG_EXPORT_MAX_BYTES) throw new WorkerFailure('PNG_LIMIT_EXCEEDED');
    return {
      data,
      contentType: document.numPages === 1 ? 'image/png' : 'application/zip',
      pageCount: document.numPages,
      pageSizes,
    };
  } finally {
    await task.destroy();
  }
}

process.once('message', (message: unknown) => {
  void (async () => {
    if (!isRecord(message) || !(message.pdf instanceof Uint8Array))
      throw new WorkerFailure('PNG_INVALID_FILE');
    const pdf = message.pdf;
    if (
      pdf.byteLength < 8 ||
      pdf.byteLength > 20 * 1024 * 1024 ||
      Buffer.from(pdf.subarray(0, 5)).toString() !== '%PDF-'
    )
      throw new WorkerFailure('PNG_INVALID_FILE');
    return renderPdf(pdf);
  })()
    .then((result) => {
      process.send?.({result}, () => process.exit(0));
    })
    .catch((error: unknown) => {
      const reason = error instanceof WorkerFailure ? error.reason : 'PNG_RENDER_FAILED';
      process.send?.({error: reason}, () => process.exit(0));
    });
});
