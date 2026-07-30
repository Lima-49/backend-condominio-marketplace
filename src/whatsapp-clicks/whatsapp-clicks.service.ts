import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordClickInput {
  productId: string;
  buyerId: string;
  sellerId: string;
  condominiumId: string;
}

/**
 * Unico ponto do backend que monta a URL `wa.me` com o numero bruto do
 * vendedor (docs/architecture/API_SPEC.md secao 5). O numero nunca deve
 * ser retornado separado da URL nem trafegar em outro payload.
 */
@Injectable()
export class WhatsappClicksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  buildUrl(sellerWhatsapp: string, productName: string, productId: string): string {
    const countryCode = this.configService.get<string>('WHATSAPP_COUNTRY_CODE') ?? '55';
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:4200').replace(/\/$/, '');
    const productUrl = `${frontendUrl}/produtos/${productId}`;
    const message = `Ola! Vi seu anuncio "${productName}" no Vitrine do Condominio e tenho interesse. ${productUrl}`;
    return `https://wa.me/${countryCode}${sellerWhatsapp}?text=${encodeURIComponent(message)}`;
  }

  async recordClick(input: RecordClickInput): Promise<void> {
    // As FKs compostas de whatsapp_clicks reforcam no banco que produto,
    // comprador e vendedor pertencem todos ao mesmo condominio.
    await this.prisma.whatsappClick.create({
      data: {
        productId: input.productId,
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        condominiumId: input.condominiumId,
      },
    });
  }
}
