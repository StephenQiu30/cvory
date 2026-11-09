import {Module} from '@nestjs/common';
import {ImageModule} from '../files/image.module';
import {AccountController} from './account.controller';
import {AccountService} from './account.service';
@Module({
  imports: [ImageModule],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
