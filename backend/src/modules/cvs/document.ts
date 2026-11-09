import {z} from 'zod';
import {invalid} from '../../common/errors';

function content(value: unknown): boolean {
  if (value === null || typeof value === 'string') return JSON.stringify(value).length <= 150000;
  const stack: Array<[unknown, number, boolean]> = [[value, 0, true]];
  let count = 0;
  if (JSON.stringify(value).length > 150000) return false;
  while (stack.length) {
    const entry = stack.pop();
    if (!entry) break;
    const [item, depth, root] = entry;
    if (++count > 5000 || depth > 20 || !item || typeof item !== 'object' || Array.isArray(item))
      return false;
    const node = item as Record<string, unknown>;
    if (
      !['doc', 'paragraph', 'text', 'bulletList', 'orderedList', 'listItem', 'hardBreak'].includes(
        String(node.type),
      ) ||
      (root && node.type !== 'doc')
    )
      return false;
    if (node.text !== undefined && typeof node.text !== 'string') return false;
    if (node.type === 'text' && typeof node.text !== 'string') return false;
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks)) return false;
      for (const value of node.marks) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const mark = value as Record<string, unknown>;
        if (!['bold', 'italic', 'code', 'link'].includes(String(mark.type))) return false;
        if (mark.type === 'link') {
          const attrs = mark.attrs;
          if (
            !attrs ||
            typeof attrs !== 'object' ||
            !('href' in attrs) ||
            typeof attrs.href !== 'string' ||
            !/^(https?:|mailto:|tel:)/i.test(attrs.href)
          )
            return false;
        }
      }
    }
    const children = node.content ?? [];
    if (!Array.isArray(children)) return false;
    for (const child of children) stack.push([child, depth + 1, false]);
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
