import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';
import { HealthController } from './health.controller';
import { AirportModule } from './modules/airport/airport.module';
import { GraphqlClientModule } from './modules/graphql-client/graphql-client.module';
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
    McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
