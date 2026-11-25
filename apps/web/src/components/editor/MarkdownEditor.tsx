import { useRef, useState } from "react";
import { Bold, Code, Eye, Italic, Link2, List, ListChecks, ListOrdered, Pencil, Strikethrough } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export function MarkdownView({ value, className }: { value: string; className?: string }) {
  // renderMarkdown escapa todo o texto antes de gerar as tags permitidas (seguro contra XSS).
  return <div className={cn("space-y-1 text-sm leading-relaxed", className)} dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />;
}

type Wrap = { before: string; after?: string; line?: boolean };

const TOOLS: Array<{ icon: typeof Bold; label: string; wrap: Wrap }> = [
  { icon: Bold, label: "Negrito", wrap: { before: "**", after: "**" } },
  { icon: Italic, label: "Itálico", wrap: { before: "*", after: "*" } },
  { icon: Strikethrough, label: "Tachado", wrap: { before: "~~", after: "~~" } },
  { icon: Code, label: "Código", wrap: { before: "`", after: "`" } },
  { icon: List, label: "Lista", wrap: { before: "- ", line: true } },
  { icon: ListOrdered, label: "Lista numerada", wrap: { before: "1. ", line: true } },
  { icon: ListChecks, label: "Lista de verificação", wrap: { before: "- [ ] ", line: true } },
  { icon: Link2, label: "Link", wrap: { before: "[", after: "](https://)" } },
];

/** Editor de texto rico em Markdown: barra de formatação, atalhos (Ctrl+B/I) e pré-visualização. */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  maxLength,
  id,
  autoFocus,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  id?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const apply = ({ before, after = "", line }: Wrap) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const start = line ? value.lastIndexOf("\n", s - 1) + 1 : s;
    const selected = value.slice(start, e);
    const next = line ? value.slice(0, start) + before + selected + value.slice(e) : value.slice(0, s) + before + selected + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = line ? e + before.length : s + before.length + selected.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring">
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
        {TOOLS.map((t) => (
          <Button key={t.label} type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={preview} onClick={() => apply(t.wrap)} aria-label={t.label} title={t.label}>
            <t.icon className="h-3.5 w-3.5" />
          </Button>
        ))}
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-xs" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
          {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {preview ? "Editar" : "Visualizar"}
        </Button>
      </div>
      {preview ? (
        <div className="min-h-24 px-3 py-2">{value.trim() ? <MarkdownView value={value} /> : <p className="text-sm text-muted-foreground">Nada para visualizar.</p>}</div>
      ) : (
        <Textarea
          ref={ref}
          id={id}
          rows={rows}
          autoFocus={autoFocus}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
              e.preventDefault();
              apply(TOOLS[0].wrap);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
              e.preventDefault();
              apply(TOOLS[1].wrap);
            }
            onKeyDown?.(e);
          }}
          className="resize-y rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      )}
    </div>
  );
}
