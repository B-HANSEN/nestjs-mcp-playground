import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChatRequest, ChatResponse } from './chat.types';
import { ChatService } from './chat.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('status')
  getStatus() {
    return this.chatService.getStatus();
  }

  @Post()
  async chat(@Body() body: ChatRequest): Promise<ChatResponse> {
    return this.chatService.chat(body);
  }
}
