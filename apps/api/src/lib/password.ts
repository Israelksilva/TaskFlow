import bcrypt from "bcryptjs";
import { isTest } from "../config/env";

/** Custo 12 em produção (S-08); menor nos testes para não deixar a suíte lenta. */
export const SALT_ROUNDS = isTest ? 5 : 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/** Hashes antigos (custo 10) são refeitos com o custo atual no próximo login bem-sucedido. */
export const needsRehash = (hash: string) => bcrypt.getRounds(hash) < SALT_ROUNDS;

/** Hash fixo usado para equalizar o tempo de resposta quando o usuário não existe. */
export const DUMMY_HASH = bcrypt.hashSync("andamo-dummy-password", SALT_ROUNDS);
