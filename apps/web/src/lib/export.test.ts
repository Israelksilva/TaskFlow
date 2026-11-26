import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildXlsx, toCsv } from "./export";

describe("exportação", () => {
  it("CSV com BOM, ponto e vírgula, aspas e decimal em pt-BR", () => {
    const csv = toCsv([["Nome", "Horas"], ['Ana "A"; B', 1.5], [null, 2]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Ana ""A""; B";1,5');
    expect(csv.endsWith(";2")).toBe(true);
  });

  it("gera um .xlsx válido com várias planilhas, texto escapado e números", async () => {
    const data = await buildXlsx([
      { name: "Resumo", rows: [["Indicador", "Valor"], ["Tarefas <criadas>", 12]] },
      { name: "Pessoas/Equipe", rows: [["Nome"], ["José & Cia"]] },
    ]);
    const files = unzipSync(data);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]));
    const wb = strFromU8(files["xl/workbook.xml"]);
    expect(wb).toContain('name="Resumo"');
    expect(wb).toContain('name="Pessoas Equipe"');
    const s1 = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(s1).toContain("Tarefas &lt;criadas&gt;");
    expect(s1).toContain('<c r="B2"><v>12</v></c>');
    expect(strFromU8(files["xl/worksheets/sheet2.xml"])).toContain("José &amp; Cia");
  });
});
