import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

// PATCH /products/:id — todos os campos opcionais (envia so o que muda).
// `status`, `sellerId` e `condominiumId` propositalmente nao existem aqui.
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 120, { message: 'name deve ter entre 1 e 120 caracteres' })
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId deve ser um uuid valido' })
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'priceCents deve ser um inteiro' })
  @Min(0, { message: 'priceCents deve ser >= 0' })
  priceCents?: number;
}
