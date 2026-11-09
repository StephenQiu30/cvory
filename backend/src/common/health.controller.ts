import {Controller, Get} from '@nestjs/common';
import {ApiOkResponse, ApiOperation, ApiProperty, ApiTags} from '@nestjs/swagger';
import {Database} from '../database/database';
import {Public} from './session.guard';
class Health {
  @ApiProperty({enum: ['ok']}) status!: 'ok';
}
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: Database) {}
  @Public()
  @Get()
  @ApiOperation({operationId: 'getHealth'})
  @ApiOkResponse({type: Health})
  async get(): Promise<Health> {
    await this.db.assertReady();
    return {status: 'ok'};
  }
}
