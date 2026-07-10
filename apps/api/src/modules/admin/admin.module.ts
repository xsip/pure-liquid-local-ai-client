import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/user.schema';
import { TokenLimitModule } from '../token-limit/token-limit.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    TokenLimitModule,
  ],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminModule {}
