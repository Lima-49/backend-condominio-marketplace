// Nunca inclui passwordHash, whatsapp, block ou apartment
// (API_SPEC.md secao 2, POST /auth/register e /auth/login).
export class AuthUserDto {
  id!: string;
  fullName!: string;
  email!: string;
  condominiumId!: string;
}

export class AuthResponseDto {
  accessToken!: string;
  user!: AuthUserDto;
}

export class MeResponseDto {
  id!: string;
  fullName!: string;
  email!: string;
  condominiumId!: string;
  condominiumName!: string;
}
