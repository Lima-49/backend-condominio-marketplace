import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { WhatsappClicksModule } from '../whatsapp-clicks/whatsapp-clicks.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [UploadsModule, WhatsappClicksModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
