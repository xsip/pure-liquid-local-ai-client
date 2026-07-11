import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { User, UserSchema } from './user.schema';
import { TokenLimitModule } from '../token-limit/token-limit.module';
import { McpClientModule } from '../mcp-client/mcp-client.module';

/**
 * AuthModule owns the JWT config, the User model, and the auth HTTP endpoints.
 *
 * The three guards (JwtAuthGuard, RolesGuard, TenantAccessGuard) are intentionally
 * NOT declared here — they are registered as APP_GUARD providers directly in
 * AppModule so NestJS resolves them in the root injector, where JwtModule and the
 * User Mongoose model are both visible.  Declaring them here as well would create
 * a second (shadow) instance that the root injector cannot satisfy.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    TokenLimitModule,
    McpClientModule,
  ],
  controllers: [AuthController],
  // Export the infra so AppModule's root injector can satisfy guard dependencies.
  exports: [MongooseModule, JwtModule],
})
export class AuthModule {}
