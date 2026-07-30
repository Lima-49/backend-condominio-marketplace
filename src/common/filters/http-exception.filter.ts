import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

interface ErrorDetail {
  field: string;
  message: string;
}

interface NormalizedErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: ErrorDetail[];
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/**
 * Normaliza toda resposta de erro para o formato definido em
 * docs/architecture/API_SPEC.md secao 1.2, e garante que nenhum
 * stack trace, query SQL ou detalhe interno vaze para o client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = this.normalizeHttpException(status, exception.getResponse());
      response.status(status).json(body);
      return;
    }

    // Erros do multer (ex.: arquivo acima de 5MB, mais de 5 arquivos) sao
    // erro de validacao de entrada do usuario, nao falha interna -> 400.
    if (exception instanceof MulterError) {
      const status = HttpStatus.BAD_REQUEST;
      response.status(status).json({
        statusCode: status,
        error: STATUS_TEXT[status],
        message: this.multerErrorMessage(exception),
      } satisfies NormalizedErrorBody);
      return;
    }

    // Erro nao mapeado: nunca expor detalhes internos ao client.
    this.logger.error(
      exception instanceof Error ? exception.stack : 'Erro desconhecido',
    );
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status).json({
      statusCode: status,
      error: STATUS_TEXT[status],
      message: 'Erro interno inesperado.',
    } satisfies NormalizedErrorBody);
  }

  private normalizeHttpException(
    status: number,
    excResponse: string | object,
  ): NormalizedErrorBody {
    const errorName = STATUS_TEXT[status] ?? 'Error';

    if (typeof excResponse === 'string') {
      return { statusCode: status, error: errorName, message: excResponse };
    }

    const body = excResponse as {
      message?: string | string[];
      details?: ErrorDetail[];
      error?: string;
    };

    const message = Array.isArray(body.message)
      ? body.message[0]
      : (body.message ?? errorName);

    return {
      statusCode: status,
      error: errorName,
      message,
      ...(body.details ? { details: body.details } : {}),
    };
  }

  private multerErrorMessage(exception: MulterError): string {
    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        return 'Arquivo excede o tamanho maximo de 5MB.';
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_UNEXPECTED_FILE':
        return 'Envie no maximo 5 fotos.';
      default:
        return 'Upload de arquivo invalido.';
    }
  }
}
