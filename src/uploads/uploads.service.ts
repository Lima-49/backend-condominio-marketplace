import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, promises as fs } from 'fs';
import { extname, join } from 'path';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_PHOTOS = 5;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface SavedFile {
  url: string;
  filename: string;
}

type StorageDriver = 'local' | 'r2';

/**
 * Storage de imagens com dois modos, escolhidos por `UPLOAD_STORAGE`:
 * - `local` (padrao, dev): grava em disco e serve via `/uploads` (ver main.ts).
 * - `r2`: grava no Cloudflare R2 (S3-compativel) — necessario em hosts com
 *   filesystem efemero (ex: Render free), onde storage local perderia as
 *   fotos a cada redeploy/restart. Ver docs/architecture/DEPLOY.md.
 */
@Injectable()
export class UploadsService {
  private readonly storage: StorageDriver;

  private readonly uploadDir!: string;
  private readonly publicAppUrl!: string;

  private readonly s3Client?: S3Client;
  private readonly r2Bucket?: string;
  private readonly r2PublicUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.storage = (this.configService.get<string>('UPLOAD_STORAGE') ?? 'local') as StorageDriver;

    if (this.storage === 'r2') {
      const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
      const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
      this.r2Bucket = this.configService.get<string>('R2_BUCKET_NAME');
      this.r2PublicUrl = (this.configService.get<string>('R2_PUBLIC_URL') ?? '').replace(/\/$/, '');

      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
      });
      return;
    }

    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') ?? './uploads';
    this.publicAppUrl = (
      this.configService.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /** Valida quantidade (1 a 5), mimetype e tamanho antes de gravar. */
  validatePhotos(files: Express.Multer.File[] | undefined): Express.Multer.File[] {
    if (!files || files.length === 0) {
      throw new BadRequestException('Envie pelo menos 1 foto.');
    }
    if (files.length > MAX_PHOTOS) {
      throw new BadRequestException('Envie no maximo 5 fotos.');
    }
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Arquivo "${file.originalname}" tem tipo invalido. Use JPEG, PNG ou WEBP.`,
        );
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException(
          `Arquivo "${file.originalname}" excede o tamanho maximo de 5MB.`,
        );
      }
    }
    return files;
  }

  async saveAll(files: Express.Multer.File[]): Promise<SavedFile[]> {
    const saved: SavedFile[] = [];
    try {
      for (const file of files) {
        saved.push(await this.saveOne(file));
      }
      return saved;
    } catch (error) {
      await this.deleteAll(saved.map((s) => s.filename));
      throw error;
    }
  }

  private async saveOne(file: Express.Multer.File): Promise<SavedFile> {
    const ext = MIME_TO_EXT[file.mimetype] ?? extname(file.originalname) ?? '';
    const filename = `${randomUUID()}${ext}`;

    if (this.storage === 'r2') {
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.r2Bucket,
          Key: filename,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return { url: `${this.r2PublicUrl}/${filename}`, filename };
    }

    const filePath = join(this.uploadDir, filename);
    await fs.writeFile(filePath, file.buffer);
    return { url: `${this.publicAppUrl}/uploads/${filename}`, filename };
  }

  async deleteAll(filenames: string[]): Promise<void> {
    if (this.storage === 'r2') {
      await Promise.all(
        filenames.map(async (filename) => {
          try {
            await this.s3Client!.send(
              new DeleteObjectCommand({ Bucket: this.r2Bucket, Key: filename }),
            );
          } catch {
            // best-effort: nao falha a requisicao se o objeto ja nao existir.
          }
        }),
      );
      return;
    }

    await Promise.all(
      filenames.map(async (filename) => {
        try {
          await fs.unlink(join(this.uploadDir, filename));
        } catch {
          // best-effort: nao falha a requisicao se o arquivo ja nao existir.
        }
      }),
    );
  }

  /** Extrai o filename a partir de uma URL publica gerada por este service. */
  filenameFromUrl(url: string): string | null {
    const prefix = this.storage === 'r2' ? `${this.r2PublicUrl}/` : `${this.publicAppUrl}/uploads/`;
    if (!url.startsWith(prefix)) {
      return null;
    }
    return url.substring(prefix.length);
  }

  get directory(): string {
    return this.uploadDir;
  }
}
