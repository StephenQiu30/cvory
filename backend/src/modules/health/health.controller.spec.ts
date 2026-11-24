import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CVORY_CONTRACT_VERSION } from '../../common/contract/contract.constants.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns ok status and current contract version on liveness', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: vi.fn(async () => [1]) } },
        { provide: RedisService, useValue: { client: { ping: vi.fn(async () => 'PONG') } } },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    expect(controller.getHealth()).toEqual({
      status: 'ok',
      contractVersion: CVORY_CONTRACT_VERSION,
    });
    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ready',
      postgres: 'up',
      redis: 'up',
    });
  });

  it('throws 503 when PostgreSQL or Redis is unreachable', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: vi.fn(async () => [1]) } },
        {
          provide: RedisService,
          useValue: { client: { ping: vi.fn(async () => { throw new Error('ECONNREFUSED'); }) } },
        },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    await expect(controller.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
