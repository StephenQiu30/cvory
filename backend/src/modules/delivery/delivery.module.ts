import {Module} from '@nestjs/common';
import {CvsModule} from '../cvs/cvs.module';
import {DeliveryController} from './delivery.controller';
import {DeliveryService} from './delivery.service';

@Module({imports: [CvsModule], controllers: [DeliveryController], providers: [DeliveryService]})
export class DeliveryModule {}
