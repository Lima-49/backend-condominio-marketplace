import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

// POST /admin/categories (docs/product/ADMIN_DASHBOARD.md H5).
// Sem campo de slug: gerado no backend a partir do nome.
export class CreateCategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 40, { message: 'name deve ter entre 2 e 40 caracteres' })
  name!: string;
}
