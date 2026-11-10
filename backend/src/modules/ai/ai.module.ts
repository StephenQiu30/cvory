import {Module} from '@nestjs/common';
import {CvsModule} from '../cvs/cvs.module';
import {AiController} from './ai.controller';
import {AiService} from './ai.service';

@Module({imports: [CvsModule], controllers: [AiController], providers: [AiService]})
export class AiModule {}
