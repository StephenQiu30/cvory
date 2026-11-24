import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CVORY_CONTRACT_VERSION } from '../../common/contract/contract.constants.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  readonly status!: string;

  @ApiProperty({ example: CVORY_CONTRACT_VERSION })
  readonly contractVersion!: number;
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ready' })
  readonly status!: string;

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  readonly postgres!: 'up' | 'down';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  readonly redis!: 'up' | 'down';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Service liveness check' })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      contractVersion: CVORY_CONTRACT_VERSION,
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Service readiness check (PostgreSQL + Redis)' })
  @ApiOkResponse({ type: ReadinessResponseDto })
  @ApiServiceUnavailableResponse({ description: 'PostgreSQL 或 Redis 不可达' })
  async getReadiness(): Promise<ReadinessResponseDto> {
    const [pgUp, redisUp] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`
        .then(() => true)
        .catch(() => false),
      this.redis.client
        .ping()
        .then((pong) => pong === 'PONG')
        .catch(() => false),
    ]);

    const body: ReadinessResponseDto = {
      status: pgUp && redisUp ? 'ready' : 'degraded',
      postgres: pgUp ? 'up' : 'down',
      redis: redisUp ? 'up' : 'down',
    };

    if (!pgUp || !redisUp) {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }
}
