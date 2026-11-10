import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {Response} from 'express';
import {OwnerRequest, Public} from '../../common/session.guard';
import {ResumeDocument} from '../publication/publication.dto';
import {FileInterceptor} from '@nestjs/platform-express';
import {CvsService} from '../cvs/cvs.service';
import {CvResource} from '../cvs/cv_resource.dto';
import {ImageService} from './image.service';
import {invalid, notFound} from '../../common/errors';
import {FilesService} from './files.service';
import {ResumeImportCandidate} from './import.dto';
import {IMPORT_MAX_BYTES} from './import.constants';
@ApiTags('files')
@Controller()
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly cvs: CvsService,
    private readonly images: ImageService,
  ) {}
  @Post('resumeImports\\:parse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({operationId: 'parseResumeImport'})
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {file: {type: 'string', format: 'binary'}},
    },
  })
  @ApiOkResponse({type: ResumeImportCandidate})
  @UseInterceptors(
    FileInterceptor('file', {limits: {fileSize: IMPORT_MAX_BYTES, files: 1, fields: 0}}),
  )
  async parseResumeImport(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: OwnerRequest,
    @Res({passthrough: true}) response: Response,
  ): Promise<ResumeImportCandidate> {
    const controller = new AbortController();
    const close = () => {
      if (!response.writableEnded) controller.abort();
    };
    response.once('close', close);
    try {
      return await this.files.parseResumeImport(file, req.owner, controller.signal);
    } finally {
      response.off('close', close);
    }
  }
  @Post('cvs/:id/avatar')
  @ApiOperation({operationId: 'uploadCvAvatar'})
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {file: {type: 'string', format: 'binary'}},
    },
  })
  @ApiCreatedResponse({type: CvResource})
  @UseInterceptors(FileInterceptor('file', {limits: {fileSize: 2097152, files: 1, fields: 0}}))
  async upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: OwnerRequest,
  ): Promise<CvResource> {
    const cv = await this.cvs.get(id, req.owner);
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype))
      throw invalid('JPEG, PNG or WebP is required.');
    const avatarUrl = await this.images.normalize(
      `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
    );
    return this.cvs.update(id, req.owner, {
      etag: cv.etag,
      profile: {...cv.profile, avatarUrl},
      updateMask: 'profile',
    });
  }
  @Get('cvs/:id/avatar')
  @ApiOperation({operationId: 'getCvAvatar'})
  @ApiProduces('image/jpeg')
  @ApiOkResponse({schema: {type: 'string', format: 'binary'}})
  async avatar(
    @Param('id') id: string,
    @Req() req: OwnerRequest,
    @Res() response: Response,
  ): Promise<void> {
    const cv = await this.cvs.get(id, req.owner);
    const image = cv.profile.avatarUrl;
    if (!image) throw notFound();
    const [header, data] = image.split(',');
    response
      .set({'Content-Type': header.slice(5).split(';')[0], 'Cache-Control': 'no-store'})
      .send(Buffer.from(data, 'base64'));
  }
  @Public()
  @Get('print/:ticket')
  @ApiOperation({operationId: 'getPrintContext'})
  @ApiOkResponse({type: ResumeDocument})
  context(@Param('ticket') ticket: string): Promise<ResumeDocument> {
    return this.files.context(ticket);
  }
  @Get('cvs/:id/pdf')
  @ApiOperation({operationId: 'exportCvPdf'})
  @ApiQuery({name: 'etag', required: true})
  @ApiProduces('application/pdf')
  @ApiOkResponse({schema: {type: 'string', format: 'binary'}})
  async pdf(
    @Param('id') id: string,
    @Query('etag') etag: string,
    @Req() req: OwnerRequest,
    @Res() response: Response,
  ): Promise<void> {
    const controller = new AbortController();
    const close = () => {
      if (!response.writableEnded) controller.abort();
    };
    response.once('close', close);
    try {
      const bytes = await this.files.pdf(id, req.owner, etag, controller.signal);
      if (!response.destroyed)
        response
          .set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="cvory-resume.pdf"',
            'Cache-Control': 'no-store',
          })
          .send(bytes);
    } finally {
      response.off('close', close);
    }
  }
}
