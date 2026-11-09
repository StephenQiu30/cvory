import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {OwnerRequest} from '../../common/session.guard';
import {ApiError} from '../../common/errors';
import {CvsService} from './cvs.service';
import {CreateCVRequest, RestoreRequest, UpdateCVRequest} from './cvs.dto';
import {CvResource, CvList, CvHistory} from './cv_resource.dto';

@ApiTags('cvs')
@Controller('cvs')
export class CvsController {
  constructor(private readonly cvs: CvsService) {}
  @Get()
  @ApiOperation({operationId: 'listCvs'})
  @ApiOkResponse({type: CvList})
  @ApiQuery({name: 'pageSize', required: false})
  @ApiQuery({name: 'pageToken', required: false})
  list(@Req() req: OwnerRequest, @Query('pageSize') size = '50', @Query('pageToken') token = '') {
    return this.cvs.list(req.owner, Number(size), token);
  }
  @Post()
  @ApiOperation({operationId: 'createCv'})
  @ApiHeader({
    name: 'X-Cvory-Owner',
    required: false,
    description: 'Expected current account for a local draft copy; never grants ownership.',
  })
  @ApiCreatedResponse({type: CvResource})
  create(
    @Body() body: CreateCVRequest,
    @Req() req: OwnerRequest,
    @Headers('x-cvory-owner') expectedOwner?: string,
  ) {
    if (expectedOwner !== undefined && expectedOwner !== req.owner)
      throw new ApiError(403, 'PERMISSION_DENIED', 'ACCOUNT_CHANGED');
    return this.cvs.create(body, req.owner);
  }
  @Get(':id')
  @ApiOperation({operationId: 'getCv'})
  @ApiOkResponse({type: CvResource})
  get(@Param('id') id: string, @Req() req: OwnerRequest) {
    return this.cvs.get(id, req.owner);
  }
  @Patch(':id')
  @ApiOperation({operationId: 'updateCv'})
  @ApiOkResponse({type: CvResource})
  update(
    @Param('id') id: string,
    @Body() body: UpdateCVRequest,
    @Req() req: OwnerRequest,
    @Headers('if-match') etag?: string,
  ) {
    return this.cvs.update(id, req.owner, body, etag);
  }
  @Post(':id\\:copy')
  @ApiOperation({operationId: 'copyCv'})
  @ApiCreatedResponse({type: CvResource})
  copy(@Param('id') id: string, @Req() req: OwnerRequest) {
    return this.cvs.copy(id, req.owner);
  }
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({operationId: 'deleteCv'})
  remove(@Param('id') id: string, @Req() req: OwnerRequest, @Headers('if-match') etag?: string) {
    return this.cvs.remove(id, req.owner, etag);
  }
  @Get(':id/revisions')
  @ApiOperation({operationId: 'listCvRevisions'})
  @ApiOkResponse({type: CvHistory})
  revisions(@Param('id') id: string, @Req() req: OwnerRequest) {
    return this.cvs.revisions(id, req.owner);
  }
  @Post(':id/revisions/:revision\\:restore')
  @ApiOperation({operationId: 'restoreCvRevision'})
  @ApiCreatedResponse({type: CvResource})
  restore(
    @Param('id') id: string,
    @Param('revision') revision: string,
    @Body() body: RestoreRequest,
    @Req() req: OwnerRequest,
  ) {
    return this.cvs.restore(id, revision, req.owner, body.requestId);
  }
}
