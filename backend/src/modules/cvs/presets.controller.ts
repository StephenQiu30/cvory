import {Body, Controller, Delete, Get, HttpCode, Param, Post, Req} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {IsObject, IsString, Length} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {Database} from '../../database/database';
import {OwnerRequest} from '../../common/session.guard';
import {invalid, notFound} from '../../common/errors';
import {Document, keys, styleSchema} from './document';
import {styleProperties} from './cv_resource.dto';
export class StylePreset {
  @ApiProperty({default: ''}) @IsString() @Length(0, 36) id!: string;
  @ApiProperty() @IsString() @Length(1, 80) displayName!: string;
  @ApiProperty(styleProperties) @IsObject() settings!: Document['styleSettings'];
}
@ApiTags('presets')
@Controller('presets')
export class PresetsController {
  constructor(private readonly db: Database) {}
  @Get()
  @ApiOperation({operationId: 'listPresets'})
  @ApiOkResponse({type: [StylePreset]})
  async list(@Req() request: OwnerRequest): Promise<StylePreset[]> {
    const rows = await this.db.rows(
      'SELECT id,display_name,settings FROM style_presets WHERE owner_id=? ORDER BY display_name,id LIMIT 500',
      [request.owner],
    );
    return rows.map((row) => {
      const value: unknown =
        typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
      const settings = styleSchema.safeParse(keys(value, 'wire'));
      if (!settings.success) throw invalid('Unsupported stored style preset.');
      return {id: String(row.id), displayName: String(row.display_name), settings: settings.data};
    });
  }
  @Post()
  @ApiOperation({operationId: 'savePreset'})
  @ApiCreatedResponse({type: StylePreset})
  async save(@Body() body: StylePreset, @Req() request: OwnerRequest): Promise<StylePreset> {
    const parsed = styleSchema.safeParse(body.settings);
    if (!parsed.success || !body.displayName.trim()) throw invalid('Invalid preset.');
    const id = body.id || randomUUID(),
      settings = parsed.data,
      displayName = body.displayName.trim();
    if (body.id) {
      const [row] = await this.db.rows('SELECT id FROM style_presets WHERE id=? AND owner_id=?', [
        id,
        request.owner,
      ]);
      if (!row) throw notFound();
      const result = await this.db.run(
        'UPDATE style_presets SET display_name=?,settings=? WHERE id=? AND owner_id=?',
        [displayName, JSON.stringify(settings), id, request.owner],
      );
      if (!result.affectedRows) throw notFound();
    } else
      await this.db.run(
        'INSERT INTO style_presets(id,owner_id,display_name,settings) VALUES (?,?,?,?)',
        [id, request.owner, displayName, JSON.stringify(settings)],
      );
    return {id, displayName, settings};
  }
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({operationId: 'deletePreset'})
  async remove(@Param('id') id: string, @Req() request: OwnerRequest): Promise<void> {
    const result = await this.db.run('DELETE FROM style_presets WHERE id=? AND owner_id=?', [
      id,
      request.owner,
    ]);
    if (!result.affectedRows) throw notFound();
  }
}
