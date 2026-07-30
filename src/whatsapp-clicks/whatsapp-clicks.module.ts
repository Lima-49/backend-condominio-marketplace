import { Module } from '@nestjs/common';
import { WhatsappClicksService } from './whatsapp-clicks.service';

@Module({
  providers: [WhatsappClicksService],
  exports: [WhatsappClicksService],
})
export class WhatsappClicksModule {}
