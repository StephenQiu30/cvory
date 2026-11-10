import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type {Response} from 'express';
import {ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags} from '@nestjs/swagger';
import {OwnerRequest, Public} from '../../common/session.guard';
import {PublicationService} from './publication.service';
import {
  PublicationReview,
  PublicationStatus,
  PublicSelection,
  PublishRequest,
  ResumeDocument,
} from './publication.dto';
@ApiTags('publication')
@Controller()
export class PublicationController {
  constructor(private readonly publications: PublicationService) {}
  @Get('publication')
  @ApiOperation({operationId: 'getPublication'})
  @ApiOkResponse({type: PublicationStatus})
  status(@Req() req: OwnerRequest): Promise<PublicationStatus> {
    return this.publications.status(req.owner);
  }
  @Post('publication\\:preview')
  @ApiOperation({operationId: 'previewPublication'})
  @ApiCreatedResponse({type: PublicationReview})
  preview(@Body() body: PublicSelection, @Req() req: OwnerRequest): Promise<PublicationReview> {
    return this.publications.preview(req.owner, body);
  }
  @Post('publication\\:publish')
  @ApiOperation({operationId: 'publishPublication'})
  @ApiCreatedResponse({type: PublicationStatus})
  publish(@Body() body: PublishRequest, @Req() req: OwnerRequest): Promise<PublicationStatus> {
    return this.publications.publish(req.owner, body.reviewId);
  }
  @Delete('publication')
  @HttpCode(204)
  @ApiOperation({operationId: 'withdrawPublication'})
  @ApiQuery({name: 'etag', required: true})
  withdraw(@Query('etag') etag: string, @Req() req: OwnerRequest): Promise<void> {
    return this.publications.withdraw(req.owner, etag);
  }
  @Public()
  @Get('public/:publicId')
  @ApiOperation({operationId: 'getPublicResume'})
  @ApiOkResponse({type: ResumeDocument})
  publicResume(
    @Param('publicId') id: string,
    @Res({passthrough: true}) response: Response,
  ): Promise<ResumeDocument> {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    return this.publications.publicResume(id);
  }
}
