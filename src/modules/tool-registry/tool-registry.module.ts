import { Module } from '@nestjs/common';
import { AirportModule } from '../airport/airport.module';
import { ToolRegistryService } from './tool-registry.service';

@Module({
  imports: [AirportModule],
  providers: [ToolRegistryService],
  exports: [ToolRegistryService],
})
export class ToolRegistryModule {}
