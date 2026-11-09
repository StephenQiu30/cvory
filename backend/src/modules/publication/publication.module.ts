import {Module} from '@nestjs/common';
import {AccountModule} from '../account/account.module';
import {CvsModule} from '../cvs/cvs.module';
import {PublicationController} from './publication.controller';
import {PublicationService} from './publication.service';
@Module({
  imports: [AccountModule, CvsModule],
  controllers: [PublicationController],
  providers: [PublicationService],
})
export class PublicationModule {}
