import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, Length, Matches, MinLength } from 'class-validator';
import { Match } from '../../common/validators/match.decorator';

export class RegisterDto {
  @IsString()
  @Length(3, 120, { message: 'fullName deve ter entre 3 e 120 caracteres' })
  fullName!: string;

  // Sanitiza espacos, parenteses, tracos e "+" antes de validar. Se sobrar
  // letra/simbolo o regex de digitos rejeita (API_SPEC.md secao 2).
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s()\-+]/g, '') : value,
  )
  @Matches(/^\d{10,11}$/, {
    message: 'whatsapp deve conter DDD + numero, somente digitos (10 ou 11 digitos)',
  })
  whatsapp!: string;

  @IsUUID('4', { message: 'condominiumId deve ser um uuid valido' })
  condominiumId!: string;

  @IsString()
  @Length(1, 20)
  block!: string;

  @IsString()
  @Length(1, 20)
  apartment!: string;

  @IsEmail({}, { message: 'email invalido' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password deve ter no minimo 8 caracteres' })
  password!: string;

  @IsString()
  @Match('password', { message: 'passwordConfirmation deve ser igual a password' })
  passwordConfirmation!: string;
}
