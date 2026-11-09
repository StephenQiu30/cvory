import {ApiProperty} from '@nestjs/swagger';
import type {SchemaObject} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {z} from 'zod';
import {Document, itemSchema, profileSchema, sectionSchema, styleSchema} from './document';

/** Named shapes are generated from the runtime schemas, never maintained separately. */
export const profileProperties = {allOf: [{$ref: '#/components/schemas/ProfileSchema'}]};
export const sectionProperties = {
  type: 'array' as const,
  items: {$ref: '#/components/schemas/SectionSchema'},
};
export const styleProperties = {allOf: [{$ref: '#/components/schemas/StyleSettingsSchema'}]};
export function documentSchemas(): Record<string, SchemaObject> {
  const result: Record<string, SchemaObject> = {};
  for (const io of ['input', 'output'] as const) {
    const suffix = io === 'input' ? 'Input' : 'Schema';
    result[`Profile${suffix}`] = z.toJSONSchema(profileSchema, {
      target: 'openapi-3.0',
      io,
    }) as SchemaObject;
    result[`SectionItem${suffix}`] = z.toJSONSchema(itemSchema, {
      target: 'openapi-3.0',
      io,
    }) as SchemaObject;
    const section = z.toJSONSchema(sectionSchema, {target: 'openapi-3.0', io}) as SchemaObject;
    if (section.properties)
      section.properties.items = {
        type: 'array',
        items: {$ref: `#/components/schemas/SectionItem${suffix}`},
        default: [],
      };
    result[`Section${suffix}`] = section;
    result[`StyleSettings${suffix}`] = z.toJSONSchema(styleSchema, {
      target: 'openapi-3.0',
      io,
    }) as SchemaObject;
  }
  return result;
}

export class CVResource implements Document {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() etag!: string;
  @ApiProperty(profileProperties) profile!: Document['profile'];
  @ApiProperty(sectionProperties) sections!: Document['sections'];
  @ApiProperty(styleProperties) styleSettings!: Document['styleSettings'];
  @ApiProperty() createTime!: string;
  @ApiProperty() updateTime!: string;
}
export class CvList {
  @ApiProperty({type: [CVResource]}) cvs!: CVResource[];
  @ApiProperty() totalSize!: number;
  @ApiProperty() nextPageToken!: string;
}
export class CvRevision {
  @ApiProperty({enum: [1]}) formatVersion!: 1;
  @ApiProperty() id!: string;
  @ApiProperty() createTime!: string;
  @ApiProperty({type: CVResource}) document!: CVResource;
}
export class CvHistory {
  @ApiProperty() retentionLimit!: number;
  @ApiProperty({type: [CvRevision]}) revisions!: CvRevision[];
}

export {CVResource as CvResource};
