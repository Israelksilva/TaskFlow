import { db } from "./index";
import { migrate } from "./migrate";

const applied = await migrate(db);
console.log(
  applied.length
    ? `✅ Migrações aplicadas: ${applied.join(", ")}`
    : "✅ Banco já está atualizado (nenhuma migração pendente)",
);
await db.close();
