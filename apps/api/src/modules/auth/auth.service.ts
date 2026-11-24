import type { AuthResponse, LoginInput, RegisterInput, User } from "@andamo/shared";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../../lib/password";
import { signAccessToken } from "../../lib/token";
import { ConflictError, UnauthorizedError } from "../../shared/errors";
import { toUserDTO } from "../users/user.mapper";
import { userRepository } from "../users/user.repository";

export const authService = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new ConflictError("Este e-mail já está cadastrado", "EMAIL_IN_USE");

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({ name: input.name, email: input.email, passwordHash });

    return { user: toUserDTO(user), token: signAccessToken(user.id) };
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await userRepository.findByEmail(input.email);
    // Sempre compara o hash para não revelar (pelo tempo de resposta) se o e-mail existe.
    const valid = await verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !valid) {
      throw new UnauthorizedError("E-mail ou senha inválidos", "INVALID_CREDENTIALS");
    }

    return { user: toUserDTO(user), token: signAccessToken(user.id) };
  },

  async me(userId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError("Usuário não encontrado", "USER_NOT_FOUND");
    return toUserDTO(user);
  },
};
