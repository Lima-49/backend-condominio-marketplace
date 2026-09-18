import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListProductsQueryDto } from './list-products-query.dto';

describe('ListProductsQueryDto', () => {
  it('rejeita status=sold (produto vendido nunca aparece na vitrine geral)', async () => {
    const dto = plainToInstance(ListProductsQueryDto, { status: 'sold' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('aceita status=available e status=reserved', async () => {
    for (const status of ['available', 'reserved']) {
      const dto = plainToInstance(ListProductsQueryDto, { status });
      const errors = await validate(dto);
      expect(errors.filter((error) => error.property === 'status')).toHaveLength(0);
    }
  });
});
