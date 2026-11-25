import { useState } from "react";
import { Bell, Inbox, Info, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusMessage } from "@/components/ui/status-message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PriorityBadge } from "@/features/tasks/components/TaskBadges";

const COLORS = [
  { token: "primary", label: "Violeta (primária)" },
  { token: "primary-glow", label: "Violeta claro" },
  { token: "coral", label: "Coral (destaque)" },
  { token: "coral-strong", label: "Coral para texto" },
  { token: "background", label: "Fundo" },
  { token: "card", label: "Superfície" },
  { token: "muted", label: "Suave" },
  { token: "border", label: "Borda" },
  { token: "foreground", label: "Texto" },
  { token: "muted-foreground", label: "Texto secundário" },
  { token: "success", label: "Sucesso" },
  { token: "warning", label: "Atenção" },
  { token: "destructive", label: "Erro / destrutivo" },
];

const TYPE_SCALE = [
  { className: "font-display text-3xl font-extrabold tracking-tight", label: "Título de página · Jakarta 30/800" },
  { className: "font-display text-xl font-bold", label: "Título de seção · Jakarta 20/700" },
  { className: "text-base font-semibold", label: "Subtítulo · Inter 16/600" },
  { className: "text-sm", label: "Texto · Inter 14/400" },
  { className: "text-xs text-muted-foreground", label: "Legenda · Inter 12/400" },
];

const SHADOWS = ["xs", "sm", "md", "lg"] as const;
const RADII = [
  { className: "rounded-sm", label: "sm" },
  { className: "rounded-md", label: "md" },
  { className: "rounded-lg", label: "lg" },
  { className: "rounded-xl", label: "xl" },
  { className: "rounded-full", label: "full" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Referência viva do design system: tokens e componentes como são usados no app. */
export default function DesignSystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <header className="mb-6">
        <Badge variant="brand">Interno</Badge>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Design system</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Tokens e componentes do Andamo. Tudo aqui usa as mesmas variáveis do app, então reflete o tema claro ou
          escuro atual. Tokens ficam em <code className="rounded bg-muted px-1 py-0.5 text-xs">index.css</code> e{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">tailwind.config.ts</code>.
        </p>
      </header>

      <Tabs defaultValue="fundamentos">
        <TabsList aria-label="Seções do design system">
          <TabsTrigger value="fundamentos">Fundamentos</TabsTrigger>
          <TabsTrigger value="componentes">Componentes</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="fundamentos" className="space-y-5">
          <Section title="Cores" description="Violeta como cor primária, coral como destaque pontual. Use sempre os tokens.">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {COLORS.map(({ token, label }) => (
                <li key={token} className="overflow-hidden rounded-lg border">
                  <div className="h-14 border-b" style={{ background: `hsl(var(--${token}))` }} />
                  <div className="p-2.5">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="font-mono text-xs text-muted-foreground">--{token}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-10 w-28 rounded-lg bg-brand" />
              <p className="text-sm text-muted-foreground">
                <code className="text-xs">bg-brand</code> — gradiente da marca. Reservado para a ação principal da
                página e a identidade; não usar em superfícies grandes.
              </p>
            </div>
          </Section>

          <Section title="Tipografia" description="Plus Jakarta Sans para títulos, Inter para interface e texto.">
            <div className="space-y-4">
              {TYPE_SCALE.map(({ className, label }) => (
                <div key={label} className="flex flex-col gap-1 border-b pb-4 last:border-0 last:pb-0">
                  <p className={className}>Seu trabalho, em andamento</p>
                  <p className="font-mono text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Elevação, raio e espaçamento">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold">Sombras</h3>
                <div className="flex flex-wrap gap-4">
                  {SHADOWS.map((s) => (
                    <div key={s} className={`flex h-16 w-20 items-center justify-center rounded-lg border bg-card text-xs shadow-${s}`}>
                      shadow-{s}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold">Raios</h3>
                <div className="flex flex-wrap gap-4">
                  {RADII.map(({ className, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5">
                      <div className={`h-12 w-12 border-2 border-primary/50 bg-primary/10 ${className}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <h3 className="mb-3 text-sm font-semibold">Espaçamento (escala de 4 px)</h3>
                <div className="flex flex-wrap items-end gap-3">
                  {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                    <div key={n} className="flex flex-col items-center gap-1.5">
                      <div className="bg-primary/70" style={{ width: n * 4, height: n * 4 }} />
                      <span className="text-xs text-muted-foreground">{n * 4}px</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <h3 className="mb-1 text-sm font-semibold">Movimento</h3>
                <p className="text-sm text-muted-foreground">
                  <code className="text-xs">duration-fast</code> 120 ms (hover, pressionar) ·{" "}
                  <code className="text-xs">duration-normal</code> 200 ms (menus, modais) ·{" "}
                  <code className="text-xs">duration-slow</code> 320 ms (painéis). Curva{" "}
                  <code className="text-xs">ease-out</code>. Com “reduzir movimento” ativo no sistema, as animações são
                  desligadas.
                </p>
              </div>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="componentes" className="space-y-5">
          <Section title="Botões">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="brand">
                <Plus aria-hidden /> Ação principal
              </Button>
              <Button>Primário</Button>
              <Button variant="outline">Contorno</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="ghost">Fantasma</Button>
              <Button variant="destructive">
                <Trash2 aria-hidden /> Excluir
              </Button>
              <Button variant="link">Link</Button>
              <Button disabled>Desabilitado</Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm">Pequeno</Button>
              <Button>Padrão</Button>
              <Button size="lg">Grande</Button>
              <Button size="icon" variant="outline" aria-label="Editar">
                <Pencil aria-hidden />
              </Button>
            </div>
          </Section>

          <Section title="Campos">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ds-input">Título</Label>
                <Input id="ds-input" placeholder="Ex.: Revisar proposta" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-select">Prioridade</Label>
                <Select defaultValue="media">
                  <SelectTrigger id="ds-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-error">Com erro</Label>
                <Input id="ds-error" aria-invalid aria-describedby="ds-error-msg" className="border-destructive" defaultValue="x" />
                <p id="ds-error-msg" className="text-sm text-destructive">
                  O título precisa ter ao menos 2 caracteres.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-disabled">Desabilitado</Label>
                <Input id="ds-disabled" disabled value="Somente leitura" readOnly />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ds-textarea">Descrição</Label>
                <Textarea id="ds-textarea" placeholder="Detalhes da tarefa" />
              </div>
            </div>
          </Section>

          <Section title="Badges, avatar e navegação">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Padrão</Badge>
              <Badge variant="brand">Marca</Badge>
              <Badge variant="coral">Destaque</Badge>
              <Badge variant="success">Concluído</Badge>
              <Badge variant="warning">Para hoje</Badge>
              <Badge variant="destructive">Atrasada</Badge>
              <Badge variant="outline">Contorno</Badge>
              <PriorityBadge priority="alta" />
              <PriorityBadge priority="media" />
              <PriorityBadge priority="baixa" />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-6">
              <div className="flex -space-x-2">
                {["AL", "MS", "JP"].map((i) => (
                  <Avatar key={i} className="h-9 w-9 ring-2 ring-card">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{i}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Breadcrumb items={[{ label: "Workspace", to: "/app" }, { label: "Projeto" }, { label: "Quadro" }]} />
            </div>
          </Section>

          <Section title="Sobreposições" description="Tooltip, menu e modal: navegáveis por teclado e com foco preso no modal.">
            <div className="flex flex-wrap items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Informações">
                    <Info aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Dica curta e objetiva</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <MoreHorizontal aria-hidden /> Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                Abrir modal
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Título do modal</DialogTitle>
                    <DialogDescription>Explique em uma frase o que vai acontecer.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => setDialogOpen(false)}>Confirmar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-5">
          <Section title="Estados">
            <div className="space-y-2">
              <StatusMessage tone="loading">Salvando alterações…</StatusMessage>
              <StatusMessage tone="success">Alterações salvas.</StatusMessage>
              <StatusMessage tone="error">Não foi possível salvar. Tente novamente.</StatusMessage>
            </div>
          </Section>

          <Section title="Toasts" description="Confirmação de ações; erros importantes também aparecem junto ao campo.">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => toast.success("Tarefa criada", { description: "Revisar proposta" })}>
                Sucesso
              </Button>
              <Button variant="outline" onClick={() => toast.error("Não foi possível salvar")}>
                Erro
              </Button>
              <Button variant="outline" onClick={() => toast("Lembrete", { description: "Você tem 2 tarefas para hoje." })}>
                Neutro
              </Button>
            </div>
          </Section>

          <Section title="Carregamento (skeleton)">
            <div className="grid gap-3 sm:grid-cols-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2 rounded-xl border p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Estado vazio">
            <EmptyState
              icon={Inbox}
              headingLevel={3}
              title="Nada por aqui ainda"
              description="Explique o que aparece nesta área e ofereça a próxima ação."
              action={
                <Button variant="brand">
                  <Bell aria-hidden /> Ação principal
                </Button>
              }
            />
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
