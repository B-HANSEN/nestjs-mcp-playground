import { Module } from '@nestjs/common';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { AirportService } from './airport.service';

@Module({
  imports: [GraphqlClientModule],
  providers: [AirportService],
  exports: [AirportService],
})
export class AirportModule {}
