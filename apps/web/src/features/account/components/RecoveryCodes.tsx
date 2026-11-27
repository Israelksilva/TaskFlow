import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Lista dos códigos de recuperação, com copiar e baixar. Só aparecem uma vez. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Códigos copiados.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  function download() {
    const blob = new Blob(
      [`Andamo — códigos de recuperação\nCada código vale uma vez.\n\n${text}\n`],
      {
        type: "text/plain",
      },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "andamo-codigos-de-recuperacao.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Guarde estes códigos em um lugar seguro. Se perder o celular, cada um permite entrar uma
        vez. Eles não serão mostrados de novo.
      </p>
      <ul
        aria-label="Códigos de recuperação"
        className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <Copy aria-hidden /> Copiar
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download aria-hidden /> Baixar .txt
        </Button>
      </div>
    </div>
  );
}
