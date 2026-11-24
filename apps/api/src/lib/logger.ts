import { pino } from "pino";
import { env, isProduction } from "../config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: ["req.headers.authorization", "*.password", "*.passwordHash"],
  transport: isProduction
    ? undefined
    : env.LOG_LEVEL === "silent"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});
