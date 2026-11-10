import mammoth from 'mammoth';
import type * as Parse5 from 'parse5';
import type * as PdfJs from 'pdfjs-dist/legacy/build/pdf.mjs';
import yauzl from 'yauzl';
import {readFile, stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join, resolve, sep} from 'node:path';
import {
  IMPORT_MAX_ARCHIVE_BYTES,
  IMPORT_MAX_ARCHIVE_ENTRIES,
  IMPORT_MAX_BLOCKS,
  IMPORT_MAX_BLOCK_CHARACTERS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_PDF_PAGES,
  IMPORT_MAX_TEXT_CHARACTERS,
} from '../import.constants';

const localRequire = createRequire(__filename);
const parse5 = localRequire('parse5') as typeof Parse5;
const pdfjs = localRequire('pdfjs-dist/legacy/build/pdf.mjs') as typeof PdfJs;

type ImportFormat = 'docx' | 'pdf';
type BlockKind = 'heading' | 'paragraph' | 'list-item' | 'table-row' | 'line';
type ImportBlock = {
  kind: BlockKind;
  order: number;
  text: string;
  page?: number;
  position?: {x: number; y: number};
};
type ImportResult = {
  format: ImportFormat;
  pageCount?: number;
  blocks: ImportBlock[];
  warnings: string[];
};
type WorkerFailureReason =
  | 'INVALID_FILE'
  | 'INVALID_ARCHIVE'
  | 'ENCRYPTED_FILE'
  | 'IMPORT_LIMIT_EXCEEDED'
  | 'NO_TEXT_LAYER'
  | 'IMPORT_PARSE_FAILED';

class WorkerFailure extends Error {
  constructor(readonly reason: WorkerFailureReason) {
    super(reason);
  }
}

const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function cleanText(value: string): string {
  return value
    .replace(controlCharacters, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function splitText(value: string): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + IMPORT_MAX_BLOCK_CHARACTERS, value.length);
    if (
      end < value.length &&
      end > start &&
      value.charCodeAt(end - 1) >= 0xd800 &&
      value.charCodeAt(end - 1) <= 0xdbff
    )
      end -= 1;
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks;
}

function createCollector(): {
  blocks: ImportBlock[];
  add: (kind: BlockKind, text: string, source?: {page: number; x: number; y: number}) => void;
} {
  const blocks: ImportBlock[] = [];
  let textCharacters = 0;
  return {
    blocks,
    add(kind, rawText, source) {
      const text = cleanText(rawText);
      if (!text) return;
      for (const chunk of splitText(text)) {
        textCharacters += chunk.length;
        if (textCharacters > IMPORT_MAX_TEXT_CHARACTERS || blocks.length >= IMPORT_MAX_BLOCKS)
          throw new WorkerFailure('IMPORT_LIMIT_EXCEEDED');
        blocks.push({
          kind,
          order: blocks.length,
          text: chunk,
          ...(source ? {page: source.page, position: {x: source.x, y: source.y}} : {}),
        });
      }
    },
  };
}

async function inspectDocxArchive(path: string): Promise<void> {
  const archive = await new Promise<yauzl.ZipFile>((resolveArchive, reject) => {
    yauzl.open(
      path,
      {lazyEntries: true, autoClose: false, validateEntrySizes: true},
      (error, file) => {
        if (error || !file) reject(new WorkerFailure('INVALID_ARCHIVE'));
        else resolveArchive(file);
      },
    );
  });

  await new Promise<void>((resolveArchive, reject) => {
    let completed = false;
    let entryCount = 0;
    let actualBytes = 0;
    let declaredBytes = 0;
    let hasContentTypes = false;
    let hasDocument = false;
    const finish = (error?: WorkerFailure) => {
      if (completed) return;
      completed = true;
      archive.close();
      if (error) reject(error);
      else if (!hasContentTypes || !hasDocument) reject(new WorkerFailure('INVALID_ARCHIVE'));
      else resolveArchive();
    };

    archive.once('error', () => finish(new WorkerFailure('INVALID_ARCHIVE')));
    archive.once('end', () => finish());
    archive.on('entry', (entry: yauzl.Entry) => {
      if (completed) return;
      entryCount += 1;
      const entryName = entry.fileName.replace(/\\/g, '/');
      if (
        entryCount > IMPORT_MAX_ARCHIVE_ENTRIES ||
        entryName.length > 1024 ||
        entry.isEncrypted() ||
        !Number.isSafeInteger(entry.uncompressedSize) ||
        entry.uncompressedSize < 0
      ) {
        finish(new WorkerFailure(entry.isEncrypted() ? 'ENCRYPTED_FILE' : 'IMPORT_LIMIT_EXCEEDED'));
        return;
      }
      declaredBytes += entry.uncompressedSize;
      if (declaredBytes > IMPORT_MAX_ARCHIVE_BYTES) {
        finish(new WorkerFailure('IMPORT_LIMIT_EXCEEDED'));
        return;
      }
      if (entryName === '[Content_Types].xml') hasContentTypes = true;
      if (entryName === 'word/document.xml') hasDocument = true;

      archive.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          finish(new WorkerFailure('INVALID_ARCHIVE'));
          return;
        }
        stream.on('data', (chunk: Buffer) => {
          actualBytes += chunk.length;
          if (actualBytes > IMPORT_MAX_ARCHIVE_BYTES) {
            stream.destroy();
            finish(new WorkerFailure('IMPORT_LIMIT_EXCEEDED'));
          }
        });
        stream.once('error', () => finish(new WorkerFailure('INVALID_ARCHIVE')));
        stream.once('end', () => {
          if (!completed) archive.readEntry();
        });
      });
    });
    archive.readEntry();
  });
}

type HtmlNode = Parse5.DefaultTreeAdapterTypes.Node;
type HtmlElement = Parse5.DefaultTreeAdapterTypes.Element;

function isElement(node: HtmlNode): node is HtmlElement {
  return 'tagName' in node && typeof node.tagName === 'string';
}

function childNodes(node: HtmlNode): HtmlNode[] {
  return 'childNodes' in node ? node.childNodes : [];
}

function nodeText(node: HtmlNode, skipLists = false): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if (!isElement(node))
    return childNodes(node)
      .map((child) => nodeText(child, skipLists))
      .join('');
  if (['script', 'style', 'svg', 'iframe', 'object', 'img'].includes(node.tagName)) return '';
  if (skipLists && ['ul', 'ol', 'table'].includes(node.tagName)) return '';
  if (node.tagName === 'br') return '\n';
  return childNodes(node)
    .map((child) => nodeText(child, skipLists))
    .join('');
}

function findRows(node: HtmlNode, rows: HtmlElement[]): void {
  if (isElement(node) && node.tagName === 'tr') {
    rows.push(node);
    return;
  }
  if (isElement(node) && node.tagName === 'table') return;
  for (const child of childNodes(node)) findRows(child, rows);
}

function findCells(node: HtmlNode, cells: HtmlElement[]): void {
  if (isElement(node) && ['td', 'th'].includes(node.tagName)) {
    cells.push(node);
    return;
  }
  if (isElement(node) && node.tagName === 'table') return;
  for (const child of childNodes(node)) findCells(child, cells);
}

function parseDocxHtml(html: string, conversionWarning: boolean): ImportResult {
  const collector = createCollector();
  const warnings = ['DOCX 仅提取文字，原版式、样式和图片不会保留。'];
  let hasImage = false;
  let hasLink = false;
  const fragment = parse5.parseFragment(html);

  const scanFeatures = (node: HtmlNode): void => {
    if (isElement(node)) {
      if (node.tagName === 'img') hasImage = true;
      if (node.tagName === 'a') hasLink = true;
    }
    for (const child of childNodes(node)) scanFeatures(child);
  };
  scanFeatures(fragment);

  const visit = (node: HtmlNode): void => {
    if (!isElement(node)) {
      for (const child of childNodes(node)) visit(child);
      return;
    }
    const tag = node.tagName;
    if (tag === 'img') return;
    if (tag === 'table') {
      const rows: HtmlElement[] = [];
      for (const child of childNodes(node)) findRows(child, rows);
      for (const row of rows) {
        const cells: HtmlElement[] = [];
        findCells(row, cells);
        collector.add('table-row', cells.map((cell) => nodeText(cell, true)).join(' | '));
      }
      return;
    }
    if (tag === 'li') {
      collector.add('list-item', nodeText(node, true));
      for (const child of childNodes(node)) {
        if (isElement(child) && ['ul', 'ol', 'table'].includes(child.tagName)) visit(child);
      }
      return;
    }
    if (/^h[1-6]$/.test(tag)) {
      collector.add('heading', nodeText(node));
      return;
    }
    if (tag === 'p') {
      collector.add('paragraph', nodeText(node));
      return;
    }
    if (['script', 'style', 'svg', 'iframe', 'object'].includes(tag)) return;
    for (const child of childNodes(node)) visit(child);
  };
  visit(fragment);

  if (conversionWarning)
    warnings.push('部分 DOCX 元素无法按常见文字结构转换，请对照提取原文校对。');
  if (hasImage) warnings.push('检测到图片；图片内容没有导入，请在简历编辑器中单独添加。');
  if (hasLink) warnings.push('检测到超链接；只导入显示文字，请核对并补充链接地址。');
  if (!collector.blocks.length) throw new WorkerFailure('NO_TEXT_LAYER');
  return {format: 'docx', blocks: collector.blocks, warnings};
}

async function parseDocx(path: string): Promise<ImportResult> {
  await inspectDocxArchive(path);
  const result = await mammoth.convertToHtml(
    {path},
    {
      externalFileAccess: false,
      includeEmbeddedStyleMap: false,
      ignoreEmptyParagraphs: false,
      convertImage: mammoth.images.imgElement(async () => ({src: ''})),
    },
  );
  if (result.value.length > IMPORT_MAX_TEXT_CHARACTERS * 4)
    throw new WorkerFailure('IMPORT_LIMIT_EXCEEDED');
  return parseDocxHtml(result.value, result.messages.length > 0);
}

type PdfTextItem = {
  str: string;
  dir: string;
  transform: [number, number, number, number, number, number];
  width: number;
  height: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPdfTextItem(value: unknown): value is PdfTextItem {
  if (!isRecord(value)) return false;
  const transform = value.transform;
  return (
    typeof value.str === 'string' &&
    typeof value.dir === 'string' &&
    Array.isArray(transform) &&
    transform.length >= 6 &&
    transform
      .slice(0, 6)
      .every(
        (coordinate) =>
          typeof coordinate === 'number' &&
          Number.isFinite(coordinate) &&
          Math.abs(coordinate) <= 20000,
      ) &&
    typeof value.width === 'number' &&
    Number.isFinite(value.width) &&
    Math.abs(value.width) <= 20000 &&
    typeof value.height === 'number' &&
    Number.isFinite(value.height) &&
    Math.abs(value.height) <= 20000
  );
}

type LocatedText = {text: string; x: number; y: number; width: number};
type TextLine = {text: string; x: number; y: number};

function joinText(line: string, part: string): string {
  if (!line || !part || /\s$/.test(line) || /^\s/.test(part)) return line + part;
  const endsWithCjk = /[\u3400-\u9fff\uf900-\ufaff]$/.test(line);
  const startsWithCjk = /^[\u3400-\u9fff\uf900-\ufaff]/.test(part);
  return line + (endsWithCjk || startsWithCjk ? '' : ' ') + part;
}

function position(value: number): number {
  return Math.round(value * 10) / 10;
}

async function parsePdf(data: Buffer): Promise<ImportResult> {
  const pdfRoot = resolve(
    dirname(localRequire.resolve('pdfjs-dist/legacy/build/pdf.mjs')),
    '../..',
  );
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    cMapUrl: `${join(pdfRoot, 'cmaps')}${sep}`,
    cMapPacked: true,
    standardFontDataUrl: `${join(pdfRoot, 'standard_fonts')}${sep}`,
    wasmUrl: `${join(pdfRoot, 'wasm')}${sep}`,
  });
  try {
    const document = await task.promise;
    if (document.numPages < 1 || document.numPages > IMPORT_MAX_PDF_PAGES)
      throw new WorkerFailure('IMPORT_LIMIT_EXCEEDED');
    const collector = createCollector();
    const emptyPages: number[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({scale: 1});
      const height = viewport.height;
      if (
        !Number.isFinite(height) ||
        !Number.isFinite(viewport.width) ||
        height <= 0 ||
        viewport.width <= 0 ||
        height > 20000 ||
        viewport.width > 20000
      )
        throw new WorkerFailure('IMPORT_LIMIT_EXCEEDED');
      const content = await page.getTextContent({includeMarkedContent: false});
      const located: LocatedText[] = [];
      for (const item of content.items as unknown[]) {
        if (!isPdfTextItem(item)) continue;
        const text = cleanText(item.str);
        if (!text) continue;
        located.push({
          text,
          x: item.transform[4],
          y: height - item.transform[5],
          width: item.width,
        });
      }
      page.cleanup();
      if (!located.length) {
        emptyPages.push(pageNumber);
        continue;
      }
      located.sort((first, second) => second.y - first.y || first.x - second.x);
      const lines: TextLine[] = [];
      for (const item of located) {
        const previous = lines[lines.length - 1];
        const tolerance = Math.max(2.5, Math.min(6, Math.abs(item.width) * 0.05));
        if (previous && Math.abs(previous.y - item.y) <= tolerance) {
          previous.text = joinText(previous.text, item.text);
          previous.x = Math.min(previous.x, item.x);
        } else {
          lines.push({text: item.text, x: item.x, y: item.y});
        }
      }
      for (const line of lines) {
        collector.add('line', line.text, {
          page: pageNumber,
          x: position(line.x),
          y: position(line.y),
        });
      }
    }
    if (!collector.blocks.length) throw new WorkerFailure('NO_TEXT_LAYER');
    const warnings = [
      'PDF 仅提取可选文字；原版式、图片和扫描件 OCR 不在当前支持范围。',
      '多栏和表格的文字顺序可能需要调整，请结合页码与坐标核对。',
    ];
    if (emptyPages.length) warnings.push(`第 ${emptyPages.join('、')} 页没有可提取文字。`);
    return {
      format: 'pdf',
      pageCount: document.numPages,
      blocks: collector.blocks,
      warnings,
    };
  } finally {
    await task.destroy();
  }
}

function isPasswordFailure(error: unknown): boolean {
  return isRecord(error) && error.name === 'PasswordException';
}

function parseRequest(value: unknown): {path: string; format: ImportFormat} {
  if (
    !isRecord(value) ||
    typeof value.path !== 'string' ||
    !['docx', 'pdf'].includes(String(value.format))
  )
    throw new WorkerFailure('INVALID_FILE');
  const path = resolve(value.path);
  if (
    !/^import-[a-f0-9]{32}$/.test(path.split(sep).at(-2) || '') ||
    path.split(sep).at(-1) !== 'source'
  )
    throw new WorkerFailure('INVALID_FILE');
  return {path, format: value.format as ImportFormat};
}

process.once('message', (message: unknown) => {
  void (async () => {
    const request = parseRequest(message);
    const file = await stat(request.path);
    if (!file.isFile() || file.size < 8 || file.size > IMPORT_MAX_BYTES)
      throw new WorkerFailure('IMPORT_LIMIT_EXCEEDED');
    const bytes = await readFile(request.path);
    const signature = request.format === 'pdf' ? '%PDF-' : 'PK\x03\x04';
    if (bytes.subarray(0, signature.length).toString() !== signature)
      throw new WorkerFailure('INVALID_FILE');
    if (request.format === 'docx') return parseDocx(request.path);
    return parsePdf(bytes);
  })()
    .then((result) => {
      process.send?.({result}, () => process.exit(0));
    })
    .catch((error: unknown) => {
      const reason =
        error instanceof WorkerFailure
          ? error.reason
          : isPasswordFailure(error)
            ? 'ENCRYPTED_FILE'
            : 'IMPORT_PARSE_FAILED';
      process.send?.({error: reason}, () => process.exit(0));
    });
});
