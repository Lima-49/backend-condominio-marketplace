import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUUID, Length, Min } from 'class-validator';

// multipart/form-data: campos textuais chegam como string; `photos` e
// tratado a parte pelo FilesInterceptor, nunca faz parte deste DTO.
export class CreateProductDto {
  @IsString()
  @Length(1, 120, { message: 'name deve ter entre 1 e 120 caracteres' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'description e obrigatorio' })
  description!: string;

  @IsUUID('4', { message: 'categoryId deve ser um uuid valido' })
  categoryId!: string;

  @Type(() => Number)
  @IsInt({ message: 'priceCents deve ser um inteiro' })
  @Min(0, { message: 'priceCents deve ser >= 0' })
  priceCents!: number;
}
