// Nunca inclui passwordHash, whatsapp, block ou apartment
// (API_SPEC.md secao 2, POST /auth/register e /auth/login).
// `role` foi adicionado na migration 0003_platform_admin_panel
// (docs/product/ADMIN_DASHBOARD.md H1) para o frontend decidir, ja no
// login/registro, se mostra a navegacao do painel administrativo.
export class AuthUserDto {
  id!: string;
  fullName!: string;
  email!: string;
  condominiumId!: string;
  role!: string;
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
  role!: string;
}
