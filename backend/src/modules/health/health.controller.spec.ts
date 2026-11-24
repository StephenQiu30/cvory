import { Test } from '@nestjs/testing';
import { CVORY_CONTRACT_VERSION } from '../../common/contract/contract.constants.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns ok status and current contract version', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const controller = moduleRef.get(HealthController);
    expect(controller.getHealth()).toEqual({
      status: 'ok',
      contractVersion: CVORY_CONTRACT_VERSION,
    });
  });
});
