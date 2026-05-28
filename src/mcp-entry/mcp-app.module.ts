import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../env.validation';
import { AirportModule } from '../modules/airport/airport.module';
import { HotelModule } from '../modules/hotel/hotel.module';
import { McpToolsService } from './mcp-tools.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
      validate: validateEnv,
    }),
    AirportModule,
    HotelModule,
  ],
  providers: [McpToolsService],
})
export class McpAppModule {}
