import {z} from 'zod';
import {invalid} from '../../common/errors';

function content(value: unknown): boolean {
  if (value === null || typeof value === 'string') return JSON.stringify(value).length <= 150000;
  if (JSON.stringify(value).length > 150000) return false;
  const stack: Array<[unknown, number, string | null]> = [[value, 0, null]];
  const childrenAllowed: Record<string, string[]> = {
    doc: ['paragraph', 'bulletList', 'orderedList'],
    paragraph: ['text', 'hardBreak'],
    bulletList: ['listItem'],
    orderedList: ['listItem'],
    listItem: ['paragraph', 'bulletList', 'orderedList'],
    text: [],
    hardBreak: [],
  };
  const object = (item: unknown): item is Record<string, unknown> =>
    !!item && typeof item === 'object' && !Array.isArray(item);
  let count = 0;
  while (stack.length) {
    const [item, depth, parent] = stack.pop()!;
    if (++count > 5000 || depth > 20 || !object(item)) return false;
    const node = item;
    const type = String(node.type);
    if (
      !Object.hasOwn(childrenAllowed, type) ||
      (parent === null ? type !== 'doc' : !childrenAllowed[parent].includes(type))
    )
      return false;
    if (
      Object.keys(node).some((key) => !['type', 'text', 'content', 'marks', 'attrs'].includes(key))
    )
      return false;
    if (type === 'text' ? typeof node.text !== 'string' || !node.text : node.text !== undefined)
      return false;
    if (node.attrs !== undefined && node.attrs !== null) {
      if (!object(node.attrs)) return false;
      const attrs = node.attrs;
      if (type === 'orderedList') {
        if (Object.keys(attrs).some((key) => !['start', 'type'].includes(key))) return false;
        if (
          attrs.start !== undefined &&
          (typeof attrs.start !== 'number' ||
            !Number.isSafeInteger(attrs.start) ||
            attrs.start < 1 ||
            attrs.start > 1000000)
        )
          return false;
        if (
          attrs.type !== undefined &&
          attrs.type !== null &&
          !['1', 'a', 'A', 'i', 'I'].includes(String(attrs.type))
        )
          return false;
      } else if (Object.keys(attrs).length) return false;
    }
    if (node.marks !== undefined) {
      if (
        !['text', 'hardBreak'].includes(type) ||
        !Array.isArray(node.marks) ||
        node.marks.length > 4
      )
        return false;
      const seen = new Set<string>();
      for (const mark of node.marks) {
        if (
          !object(mark) ||
          !['bold', 'italic', 'code', 'link'].includes(String(mark.type)) ||
          seen.has(String(mark.type))
        )
          return false;
        seen.add(String(mark.type));
        if (Object.keys(mark).some((key) => !['type', 'attrs'].includes(key))) return false;
        if (mark.type === 'link') {
          if (
            !object(mark.attrs) ||
            typeof mark.attrs.href !== 'string' ||
            mark.attrs.href.length > 10000
          )
            return false;
          try {
            if (!['https:', 'http:', 'mailto:', 'tel:'].includes(new URL(mark.attrs.href).protocol))
              return false;
          } catch {
            return false;
          }
          if (
            Object.keys(mark.attrs).some(
              (key) => !['href', 'target', 'rel', 'class', 'title'].includes(key),
            )
          )
            return false;
          if (
            Object.values(mark.attrs).some(
              (attr) => attr !== null && (typeof attr !== 'string' || attr.length > 10000),
            )
          )
            return false;
        } else if (
          mark.attrs !== undefined &&
          mark.attrs !== null &&
          (!object(mark.attrs) || Object.keys(mark.attrs).length)
        )
          return false;
      }
    }
    const children = node.content ?? [];
    if (!Array.isArray(children)) return false;
    if (['text', 'hardBreak'].includes(type) && children.length) return false;
    if (['bulletList', 'orderedList', 'listItem'].includes(type) && !children.length) return false;
    if (type === 'listItem' && (!object(children[0]) || children[0].type !== 'paragraph'))
      return false;
    for (const child of children) stack.push([child, depth + 1, type]);
  }
  return true;
}

const text = z.string().max(10000).default('');
const richText = z.unknown().default(null).refine(content, 'Invalid rich text.');
const month = z
  .string()
  .regex(/^(|\d{4}-(0[1-9]|1[0-2]))$/)
  .default('');
export const profileSchema = z.strictObject({
  fullName: text,
  headline: text,
  email: text,
  phone: text,
  location: text,
  website: text,
  github: text,
  wechat: text,
  jobStatus: text,
  expectedLocation: text,
  experienceYears: text,
  expectedSalary: text,
  hiddenFields: z.array(z.string().max(80)).max(40).default([]),
  photoHidden: z.boolean().default(false),
  photoPosition: z.enum(['left', 'right']).default('right'),
  photoX: z.number().min(0).max(100).default(50),
  photoY: z.number().min(0).max(100).default(50),
  photoScale: z.number().min(1).max(3).default(1),
  avatarUrl: z
    .string()
    .max(2800000)
    .nullable()
    .default(null)
    .refine(
      (value) => !value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
      'Only uploaded photos are allowed.',
    ),
});
export const itemSchema = z
  .strictObject({
    id: z.string().min(1).max(100),
    title: text,
    subtitle: text,
    dateRange: text,
    location: text,
    description: richText,
    startDate: month,
    endDate: month,
    current: z.boolean().default(false),
    degree: text,
    educationType: text,
    department: text,
    link: text,
    tags: z.array(z.string().max(200)).max(100).default([]),
  })
  .refine(
    (item) => item.current || !item.startDate || !item.endDate || item.endDate >= item.startDate,
    'End date precedes start date.',
  );
export const sectionSchema = z
  .strictObject({
    id: z.string().min(1).max(100),
    type: z.enum(['summary', 'experience', 'education', 'project', 'skill', 'custom']),
    title: z.string().max(200),
    visible: z.boolean().default(true),
    content: richText,
    items: z.array(itemSchema).max(200).default([]),
  })
  .refine(
    (section) => new Set(section.items.map((item) => item.id)).size === section.items.length,
    'Duplicate item ID.',
  );
export const styleSchema = z.strictObject({
  accent: z.enum(['ink', 'blue', 'graphite']).default('ink'),
  templateId: z.enum(['standard', 'compact', 'timeline']).default('standard'),
  fontSize: z.number().int().min(12).max(20).default(15),
  lineHeight: z.number().min(1.2).max(2).default(1.5),
  margin: z.number().int().min(12).max(48).default(24),
});
const documentSchema = z
  .object({
    profile: profileSchema,
    sections: z.array(sectionSchema).max(100),
    styleSettings: styleSchema,
  })
  .refine(
    (doc) => new Set(doc.sections.map((section) => section.id)).size === doc.sections.length,
    'Duplicate section ID.',
  );
export type Document = z.infer<typeof documentSchema>;

export function validateDocument(value: unknown): Document {
  const parsed = documentSchema.safeParse(value);
  if (!parsed.success) throw invalid('Invalid resume content, dates or style.');
  return parsed.data;
}

/** Storage keeps the legacy snake_case JSON; the wire contract uses camelCase. */
export function keys(value: unknown, mode: 'storage' | 'wire'): unknown {
  if (Array.isArray(value)) return value.map((item) => keys(item, mode));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        mode === 'wire'
          ? key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase())
          : key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`),
        keys(item, mode),
      ]),
    );
  return value;
}

export const emptyDocument = (): Document =>
  validateDocument({
    profile: {},
    sections: [
      ['summary', '个人简介'],
      ['experience', '工作经历'],
      ['project', '项目经历'],
      ['education', '教育经历'],
      ['skill', '专业技能'],
    ].map(([type, title]) => ({id: `sec-${type}`, type, title})),
    styleSettings: {},
  });
