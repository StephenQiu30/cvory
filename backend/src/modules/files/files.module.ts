import {Module} from '@nestjs/common';
import {AccountModule} from '../account/account.module';
import {CvsModule} from '../cvs/cvs.module';
import {ImageModule} from './image.module';
import {FilesController} from './files.controller';
import {FilesService} from './files.service';
@Module({
  imports: [AccountModule, CvsModule, ImageModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
