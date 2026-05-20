import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';
import { HealthController } from './health.controller';
import { AirportModule } from './modules/airport/airport.module';
import { ChatModule } from './modules/chat/chat.module';
import { GraphqlClientModule } from './modules/graphql-client/graphql-client.module';
import { HotelModule } from './modules/hotel/hotel.module';
import { McpModule } from './modules/mcp/mcp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
      validate: validateEnv,
    }),
    GraphqlClientModule,
    AirportModule,
    HotelModule,
    ChatModule,
    McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
