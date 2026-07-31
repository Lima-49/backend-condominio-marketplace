import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CondominiumsService } from '../condominiums/condominiums.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let usersService: jest.Mocked<UsersService>;
  let condominiumsService: jest.Mocked<CondominiumsService>;
  let jwtService: jest.Mocked<JwtService>;
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIdWithCondominium: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    condominiumsService = {
      findAllForDropdown: jest.fn(),
      existsById: jest.fn(),
    } as unknown as jest.Mocked<CondominiumsService>;
    jwtService = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
    } as unknown as jest.Mocked<JwtService>;

    service = new AuthService(usersService, condominiumsService, jwtService);
  });

  describe('login', () => {
    it('retorna 401 com mensagem generica quando o email nao existe', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'inexistente@example.com', password: 'qualquer123' }),
      ).rejects.toMatchObject({
        status: 401,
        response: { message: 'Credenciais invalidas' },
      });
    });

    it('retorna 401 com a mesma mensagem generica quando a senha esta errada', async () => {
      const passwordHash = await bcrypt.hash('senhaCorreta123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        condominiumId: 'condo-1',
        fullName: 'Maria Silva',
        email: 'maria@example.com',
        passwordHash,
        whatsapp: '11999999999',
        block: 'A',
        apartment: '101',
        role: 'resident',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.login({ email: 'maria@example.com', password: 'senhaErrada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('nunca retorna passwordHash no payload de sucesso', async () => {
      const passwordHash = await bcrypt.hash('senhaCorreta123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        condominiumId: 'condo-1',
        fullName: 'Maria Silva',
        email: 'maria@example.com',
        passwordHash,
        whatsapp: '11999999999',
        block: 'A',
        apartment: '101',
        role: 'resident',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.login({
        email: 'maria@example.com',
        password: 'senhaCorreta123',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('whatsapp');
      expect(result.user).not.toHaveProperty('block');
      expect(result.user).not.toHaveProperty('apartment');
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('inclui role do usuario no payload assinado e na resposta (docs/product/ADMIN_DASHBOARD.md H1)', async () => {
      const passwordHash = await bcrypt.hash('senhaCorreta123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 'admin-1',
        condominiumId: 'condo-1',
        fullName: 'Admin Plataforma',
        email: 'admin@example.com',
        passwordHash,
        whatsapp: '11999999999',
        block: 'A',
        apartment: '101',
        role: 'platform_admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.login({
        email: 'admin@example.com',
        password: 'senhaCorreta123',
      });

      expect(result.user.role).toBe('platform_admin');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'platform_admin' }),
      );
    });
  });

  describe('register', () => {
    it('rejeita condominiumId inexistente', async () => {
      condominiumsService.existsById.mockResolvedValue(null);

      await expect(
        service.register({
          fullName: 'Maria Silva',
          whatsapp: '11999999999',
          condominiumId: 'condo-invalido',
          block: 'A',
          apartment: '101',
          email: 'maria@example.com',
          password: 'senhaSegura123',
          passwordConfirmation: 'senhaSegura123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('rejeita email ja cadastrado', async () => {
      condominiumsService.existsById.mockResolvedValue({ id: 'condo-1' });
      usersService.findByEmail.mockResolvedValue({
        id: 'existing-user',
        condominiumId: 'condo-1',
        fullName: 'Outra Pessoa',
        email: 'maria@example.com',
        passwordHash: 'hash',
        whatsapp: '11999999999',
        block: 'A',
        apartment: '101',
        role: 'resident',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.register({
          fullName: 'Maria Silva',
          whatsapp: '11999999999',
          condominiumId: 'condo-1',
          block: 'A',
          apartment: '101',
          email: 'maria@example.com',
          password: 'senhaSegura123',
          passwordConfirmation: 'senhaSegura123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(usersService.create).not.toHaveBeenCalled();
    });
  });
});
