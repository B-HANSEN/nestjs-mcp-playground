import { Module } from '@nestjs/common';
import { AirportModule } from '../airport/airport.module';
import { HotelModule } from '../hotel/hotel.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AirportModule, HotelModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
