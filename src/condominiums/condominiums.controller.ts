import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CondominiumsService } from './condominiums.service';
import { CondominiumResponseDto } from './dto/condominium-response.dto';

@Controller('condominiums')
export class CondominiumsController {
  constructor(private readonly condominiumsService: CondominiumsService) {}

  @Public()
  @Get()
  async findAll(): Promise<CondominiumResponseDto[]> {
    return this.condominiumsService.findAllForDropdown();
  }
}
