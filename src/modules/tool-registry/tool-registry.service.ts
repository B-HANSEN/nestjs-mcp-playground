import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AirportService } from '../airport/airport.service';

@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(private readonly airportService: AirportService) {}

  onModuleInit() {
    this.logger.log('Tool registry initialized.');
  }
}
