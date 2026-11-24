import bcrypt from "bcryptjs";
import { isTest } from "../config/env";

// Custo menor nos testes para não deixar a suíte lenta.
const SALT_ROUNDS = isTest ? 4 : 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/** Hash fixo usado para equalizar o tempo de resposta quando o usuário não existe. */
export const DUMMY_HASH = bcrypt.hashSync("andamo-dummy-password", SALT_ROUNDS);
