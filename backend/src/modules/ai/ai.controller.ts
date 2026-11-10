import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type {Response} from 'express';
import {OwnerRequest} from '../../common/session.guard';
import {
  AiConnectionTestRequest,
  AiConnectionTestResult,
  AiAnalysisPreview,
  AiProviderId,
  AiProviderList,
  AiReportList,
  AiReportQuery,
  AiReportResource,
  AnalyzeCvRequest,
  PreviewCvRequest,
  UpdateAiProviderRequest,
} from './ai.dto';
import {AiService} from './ai.service';

@ApiTags('ai')
@Controller()
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('ai/providers')
  @ApiOperation({operationId: 'listAiProviders'})
  @ApiOkResponse({type: AiProviderList})
  async providers(@Req() request: OwnerRequest): Promise<AiProviderList> {
    return this.ai.listProviders(request.owner);
  }

  @Patch('ai/providers/:provider')
  @ApiOperation({operationId: 'updateAiProvider'})
  @ApiOkResponse({type: AiProviderList})
  async updateProvider(
    @Param('provider', new ParseEnumPipe(AiProviderId)) provider: AiProviderId,
    @Body() body: UpdateAiProviderRequest,
    @Req() request: OwnerRequest,
  ): Promise<AiProviderList> {
    await this.ai.updateProvider(request.owner, provider, body.modelId, body.apiKey);
    return this.ai.listProviders(request.owner);
  }

  @Delete('ai/providers/:provider')
  @HttpCode(204)
  @ApiOperation({operationId: 'deleteAiProvider'})
  @ApiNoContentResponse()
  async deleteProvider(
    @Param('provider', new ParseEnumPipe(AiProviderId)) provider: AiProviderId,
    @Req() request: OwnerRequest,
  ): Promise<void> {
    await this.ai.deleteProvider(request.owner, provider);
  }

  @Post('ai/providers/:provider\\:test')
  @HttpCode(200)
  @ApiOperation({operationId: 'testAiProvider'})
  @ApiOkResponse({type: AiConnectionTestResult})
  async testProvider(
    @Param('provider', new ParseEnumPipe(AiProviderId)) provider: AiProviderId,
    @Body() body: AiConnectionTestRequest,
    @Req() request: OwnerRequest,
    @Res({passthrough: true}) response: Response,
  ): Promise<AiConnectionTestResult> {
    const abortController = new AbortController();
    response.on('close', () => {
      if (!response.writableEnded) abortController.abort();
    });
    return this.ai.testProvider(request.owner, provider, body.requestId, abortController.signal);
  }

  @Post('ai\\:preview')
  @HttpCode(200)
  @ApiOperation({operationId: 'previewCvAnalysis'})
  @ApiOkResponse({type: AiAnalysisPreview})
  async preview(
    @Body() body: PreviewCvRequest,
    @Req() request: OwnerRequest,
  ): Promise<AiAnalysisPreview> {
    return this.ai.preview(request.owner, body);
  }

  @Post('ai\\:analyze')
  @HttpCode(200)
  @ApiOperation({operationId: 'analyzeCv'})
  @ApiOkResponse({type: AiReportResource})
  async analyze(
    @Body() body: AnalyzeCvRequest,
    @Req() request: OwnerRequest,
    @Res({passthrough: true}) response: Response,
  ): Promise<AiReportResource> {
    const abortController = new AbortController();
    response.on('close', () => {
      if (!response.writableEnded) abortController.abort();
    });
    return this.ai.analyze(request.owner, body, abortController.signal);
  }

  @Get('ai/reports')
  @ApiOperation({operationId: 'listAiReports'})
  @ApiQuery({name: 'pageSize', required: false, type: Number})
  @ApiQuery({name: 'pageToken', required: false, type: String})
  @ApiOkResponse({type: AiReportList})
  async reports(
    @Query() query: AiReportQuery,
    @Req() request: OwnerRequest,
  ): Promise<AiReportList> {
    return this.ai.listReports(request.owner, query.pageSize, query.pageToken);
  }

  @Get('ai/reports/:id')
  @ApiOperation({operationId: 'getAiReport'})
  @ApiOkResponse({type: AiReportResource})
  async report(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: OwnerRequest,
  ): Promise<AiReportResource> {
    return this.ai.getReport(request.owner, id);
  }
}
