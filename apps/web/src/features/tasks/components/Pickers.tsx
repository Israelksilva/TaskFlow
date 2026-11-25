import { useState } from "react";
import { Check, Plus, Tag, UserPlus } from "lucide-react";
import type { Label, Member } from "@andamo/shared";
import { UserAvatar } from "@/components/feedback/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeText } from "@andamo/shared";
import { cn } from "@/lib/utils";

/** Seleção múltipla de responsáveis entre os membros do workspace. */
export function MemberPicker({
  members,
  value,
  onChange,
  disabled,
}: {
  members: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const selected = members.filter((m) => value.includes(m.id));
  const filtered = members.filter((m) => normalizeText(`${m.name} ${m.email}`).includes(normalizeText(q)));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-accent disabled:pointer-events-none"
          aria-label="Responsáveis"
        >
          {selected.length ? (
            selected.map((m) => (
              <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs font-medium">
                <UserAvatar user={m} className="h-5 w-5 ring-0" /> {m.name.split(" ")[0]}
              </span>
            ))
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <UserPlus className="h-4 w-4" aria-hidden /> Atribuir
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa…" className="mb-2 h-8" autoFocus />
        <div className="scrollbar-thin max-h-60 overflow-y-auto">
          {filtered.map((m) => (
            <button key={m.id} onClick={() => toggle(m.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent" aria-pressed={value.includes(m.id)}>
              <UserAvatar user={m} className="h-6 w-6 ring-0" />
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              {value.includes(m.id) && <Check className="h-4 w-4 text-primary" aria-hidden />}
            </button>
          ))}
          {!filtered.length && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Ninguém encontrado.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LabelChip({ label, className }: { label: Pick<Label, "name" | "color">; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold", className)}
      style={{ background: `${label.color}1f`, color: label.color }}
    >
      {label.name}
    </span>
  );
}

/** Etiquetas do workspace: alternar e criar novas na hora. */
export function LabelPicker({
  labels,
  value,
  onChange,
  onCreate,
  disabled,
}: {
  labels: Label[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCreate?: (name: string) => Promise<Label>;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const selected = labels.filter((l) => value.includes(l.id));
  const filtered = labels.filter((l) => normalizeText(l.name).includes(normalizeText(q)));
  const exact = labels.some((l) => normalizeText(l.name) === normalizeText(q));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button disabled={disabled} className="flex min-h-8 flex-wrap items-center gap-1 rounded-md px-1.5 py-1 text-sm hover:bg-accent disabled:pointer-events-none" aria-label="Etiquetas">
          {selected.length ? (
            selected.map((l) => <LabelChip key={l.id} label={l} />)
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="h-4 w-4" aria-hidden /> Adicionar
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ou criar…" className="mb-2 h-8" autoFocus maxLength={40} />
        <div className="scrollbar-thin max-h-56 overflow-y-auto">
          {filtered.map((l) => (
            <button key={l.id} onClick={() => toggle(l.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent" aria-pressed={value.includes(l.id)}>
              <span className="h-3 w-3 rounded" style={{ background: l.color }} aria-hidden />
              <span className="flex-1 truncate text-left">{l.name}</span>
              {value.includes(l.id) && <Check className="h-4 w-4 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
        {onCreate && q.trim() && !exact && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start gap-2"
            onClick={async () => {
              const created = await onCreate(q.trim());
              onChange([...value, created.id]);
              setQ("");
            }}
          >
            <Plus className="h-4 w-4" /> Criar “{q.trim()}”
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
