import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {OwnerRequest} from '../../common/session.guard';
import {
  CreateDeliveryJobRequest,
  CreateDeliveryTaskRequest,
  DeliveryJobList,
  DeliveryJobResource,
  DeliveryPreferencesRequest,
  DeliveryPreferencesResource,
  DeliveryTaskList,
  DeliveryTaskResource,
} from './delivery.dto';
import {DeliveryService} from './delivery.service';

@ApiTags('delivery')
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('preferences')
  @ApiOperation({operationId: 'getDeliveryPreferences'})
  @ApiOkResponse({type: DeliveryPreferencesResource})
  preferences(@Req() request: OwnerRequest): Promise<DeliveryPreferencesResource> {
    return this.delivery.preferences(request.owner);
  }

  @Patch('preferences')
  @ApiOperation({operationId: 'updateDeliveryPreferences'})
  @ApiOkResponse({type: DeliveryPreferencesResource})
  updatePreferences(
    @Body() body: DeliveryPreferencesRequest,
    @Req() request: OwnerRequest,
  ): Promise<DeliveryPreferencesResource> {
    return this.delivery.updatePreferences(request.owner, body);
  }

  @Get('jobs')
  @ApiOperation({operationId: 'listDeliveryJobs'})
  @ApiOkResponse({type: DeliveryJobList})
  jobs(@Req() request: OwnerRequest): Promise<DeliveryJobList> {
    return this.delivery.listJobs(request.owner);
  }

  @Post('jobs')
  @ApiOperation({operationId: 'createDeliveryJob'})
  @ApiCreatedResponse({type: DeliveryJobResource})
  createJob(
    @Body() body: CreateDeliveryJobRequest,
    @Req() request: OwnerRequest,
  ): Promise<DeliveryJobResource> {
    return this.delivery.createJob(request.owner, body);
  }

  @Delete('jobs/:id')
  @HttpCode(204)
  @ApiOperation({operationId: 'deleteDeliveryJob'})
  @ApiNoContentResponse()
  deleteJob(@Param('id', ParseUUIDPipe) id: string, @Req() request: OwnerRequest): Promise<void> {
    return this.delivery.deleteJob(request.owner, id);
  }

  @Get('tasks')
  @ApiOperation({operationId: 'listDeliveryTasks'})
  @ApiQuery({name: 'pageSize', required: false, type: Number})
  @ApiQuery({name: 'pageToken', required: false, type: String})
  @ApiOkResponse({type: DeliveryTaskList})
  tasks(
    @Req() request: OwnerRequest,
    @Query('pageSize') pageSize = '50',
    @Query('pageToken') pageToken = '',
  ): Promise<DeliveryTaskList> {
    return this.delivery.listTasks(request.owner, Number(pageSize), pageToken);
  }

  @Post('tasks')
  @ApiOperation({operationId: 'createDeliveryTask'})
  @ApiCreatedResponse({type: DeliveryTaskResource})
  createTask(
    @Body() body: CreateDeliveryTaskRequest,
    @Req() request: OwnerRequest,
  ): Promise<DeliveryTaskResource> {
    return this.delivery.createTask(request.owner, body);
  }

  @Get('tasks/:id')
  @ApiOperation({operationId: 'getDeliveryTask'})
  @ApiOkResponse({type: DeliveryTaskResource})
  task(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: OwnerRequest,
  ): Promise<DeliveryTaskResource> {
    return this.delivery.getTask(request.owner, id);
  }

  @Post('tasks/:id\\:simulate')
  @HttpCode(200)
  @ApiOperation({operationId: 'simulateDeliveryTask'})
  @ApiOkResponse({type: DeliveryTaskResource})
  simulateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: OwnerRequest,
  ): Promise<DeliveryTaskResource> {
    return this.delivery.simulateTask(request.owner, id);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  @ApiOperation({operationId: 'deleteDeliveryTask'})
  @ApiNoContentResponse()
  deleteTask(@Param('id', ParseUUIDPipe) id: string, @Req() request: OwnerRequest): Promise<void> {
    return this.delivery.deleteTask(request.owner, id);
  }
}
