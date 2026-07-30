import { S3Client } from '@aws-sdk/client-s3';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { UploadsService } from './uploads.service';

function buildConfigService(uploadDir: string): ConfigService {
  const values: Record<string, string> = {
    UPLOAD_DIR: uploadDir,
    PUBLIC_APP_URL: 'http://localhost:3000',
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('UploadsService', () => {
  let uploadDir: string;
  let service: UploadsService;

  beforeEach(() => {
    uploadDir = mkdtempSync(join(tmpdir(), 'vitrine-uploads-'));
    service = new UploadsService(buildConfigService(uploadDir));
  });

  afterEach(() => {
    rmSync(uploadDir, { recursive: true, force: true });
  });

  describe('regra de pelo menos 1 foto', () => {
    it('rejeita quando nenhum arquivo e enviado (undefined)', () => {
      expect(() => service.validatePhotos(undefined)).toThrow(BadRequestException);
    });

    it('rejeita quando o array de arquivos esta vazio', () => {
      expect(() => service.validatePhotos([])).toThrow(BadRequestException);
    });

    it('aceita quando pelo menos 1 arquivo valido e enviado', () => {
      const file = {
        originalname: 'foto.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      expect(service.validatePhotos([file])).toEqual([file]);
    });
  });

  describe('limites de quantidade, mimetype e tamanho', () => {
    it('rejeita mais de 5 fotos', () => {
      const files = Array.from({ length: 6 }, (_, i) => ({
        originalname: `foto${i}.jpg`,
        mimetype: 'image/jpeg',
        size: 1024,
      })) as Express.Multer.File[];

      expect(() => service.validatePhotos(files)).toThrow(BadRequestException);
    });

    it('rejeita mimetype nao suportado', () => {
      const file = {
        originalname: 'arquivo.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      } as Express.Multer.File;

      expect(() => service.validatePhotos([file])).toThrow(BadRequestException);
    });

    it('rejeita arquivo acima de 5MB', () => {
      const file = {
        originalname: 'foto-grande.jpg',
        mimetype: 'image/jpeg',
        size: 6 * 1024 * 1024,
      } as Express.Multer.File;

      expect(() => service.validatePhotos([file])).toThrow(BadRequestException);
    });
  });
});

describe('UploadsService (driver r2)', () => {
  function buildR2ConfigService(): ConfigService {
    const values: Record<string, string> = {
      UPLOAD_STORAGE: 'r2',
      R2_ACCOUNT_ID: 'acc123',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'vitrine-condominio',
      R2_PUBLIC_URL: 'https://img.example.com',
    };
    return { get: (key: string) => values[key] } as unknown as ConfigService;
  }

  let service: UploadsService;
  let sendSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new UploadsService(buildR2ConfigService());
    sendSpy = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
  });

  afterEach(() => {
    sendSpy.mockRestore();
  });

  it('grava no bucket R2 e retorna URL publica montada com R2_PUBLIC_URL', async () => {
    const file = {
      originalname: 'foto.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake'),
    } as Express.Multer.File;

    const [saved] = await service.saveAll([file]);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(saved.url).toBe(`https://img.example.com/${saved.filename}`);
    expect(saved.filename.endsWith('.jpg')).toBe(true);
  });

  it('filenameFromUrl reconhece URLs do R2_PUBLIC_URL', () => {
    expect(service.filenameFromUrl('https://img.example.com/abc.jpg')).toBe('abc.jpg');
    expect(service.filenameFromUrl('http://localhost:3000/uploads/abc.jpg')).toBeNull();
  });

  it('deleteAll chama DeleteObjectCommand para cada arquivo sem lancar em falha', async () => {
    sendSpy.mockRejectedValueOnce(new Error('not found'));
    await expect(service.deleteAll(['a.jpg', 'b.jpg'])).resolves.toBeUndefined();
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });
});
