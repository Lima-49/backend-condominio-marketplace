import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um inteiro' })
  @Min(1, { message: 'page deve ser >= 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser um inteiro' })
  @Min(1, { message: 'limit deve ser >= 1' })
  @Max(50, { message: 'limit deve ser <= 50' })
  limit: number = 20;
}
