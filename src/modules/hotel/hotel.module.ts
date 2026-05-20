import { Module } from '@nestjs/common';
import { GraphqlClientModule } from '../graphql-client/graphql-client.module';
import { HotelRecommendationService } from './hotel-recommendation.service';

@Module({
  imports: [GraphqlClientModule],
  providers: [HotelRecommendationService],
  exports: [HotelRecommendationService],
})
export class HotelModule {}
