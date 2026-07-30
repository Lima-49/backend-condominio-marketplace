import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

interface ErrorDetail {
  field: string;
  message: string;
}

function flatten(errors: ValidationError[], parentPath = ''): ErrorDetail[] {
  const details: ErrorDetail[] = [];

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      const firstMessage = Object.values(error.constraints)[0];
      details.push({ field: path, message: firstMessage });
    }

    if (error.children && error.children.length > 0) {
      details.push(...flatten(error.children, path));
    }
  }

  return details;
}

/**
 * `exceptionFactory` do ValidationPipe global. Converte os erros do
 * class-validator para o formato de erro do contrato (secao 1.2 do
 * API_SPEC.md): message curta + details[] com { field, message }.
 */
export function formatValidationErrors(errors: ValidationError[]): BadRequestException {
  const details = flatten(errors);
  return new BadRequestException({
    message: 'Dados invalidos.',
    details,
  });
}
