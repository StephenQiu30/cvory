import {Module} from '@nestjs/common';
import {ImageModule} from '../files/image.module';
import {PresetsController} from './presets.controller';
import {CvsController} from './cvs.controller';
import {CvsService} from './cvs.service';
@Module({
  imports: [ImageModule],
  controllers: [CvsController, PresetsController],
  providers: [CvsService],
  exports: [CvsService],
})
export class CvsModule {}
