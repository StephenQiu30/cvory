import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { CVORY_CONTRACT_VERSION } from '../../common/contract/contract.constants.js';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  readonly status!: string;

  @ApiProperty({ example: CVORY_CONTRACT_VERSION })
  readonly contractVersion!: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Service liveness check' })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      contractVersion: CVORY_CONTRACT_VERSION,
    };
  }
}
