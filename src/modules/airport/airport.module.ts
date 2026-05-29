import { Module } from '@nestjs/common';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { AirportChatController } from './airport-chat.controller';
import { AirportService } from './airport.service';

@Module({
  imports: [GraphqlClientModule],
  controllers: [AirportChatController],
  providers: [AirportService],
  exports: [AirportService],
})
export class AirportModule {}
