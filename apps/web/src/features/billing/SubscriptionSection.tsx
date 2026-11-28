import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PLANS, type BillingInfo, type Subscription } from "@andamo/shared";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/use-auth";
import { getErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { billingApi } from "@/features/files/api";
import { billingKey } from "./hooks";

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS: Record<Subscription["status"], string> = {
  pending: "Aguardando autorização no Mercado Pago",
  authorized: "Ativa",
  paused: "Pausada no Mercado Pago",
  cancelled: "Cancelada",
};

export function CheckoutDialog({ ws, plan, onClose }: { ws: string; plan: "pro" | "business" | null; onClose: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const checkout = useMutation({
    mutationFn: () => billingApi.checkout(ws, { plan: plan!, payerEmail: email }),
    onSuccess: (r) => window.location.assign(r.checkoutUrl),
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  useEffect(() => {
    if (plan) setEmail(user?.email ?? "");
  }, [plan, user?.email]);
  return (
    <Dialog open={Boolean(plan)} onOpenChange={(o) => !o && !checkout.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assinar o {plan ? PLANS[plan].name : ""} — modo de teste</DialogTitle>
          <DialogDescription>
            Você será levado ao Mercado Pago em <strong>ambiente de teste</strong>: nenhuma cobrança real acontece.
            Use a conta de <strong>comprador de teste</strong> e um cartão de teste do Mercado Pago.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mp-email">E-mail do comprador de teste</Label>
          <Input id="mp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="test_user_123@testuser.com" />
          <p className="text-xs text-muted-foreground">Precisa ser o mesmo e-mail da conta de comprador de teste com que você vai entrar no Mercado Pago.</p>
        </div>
        {plan && <p className="text-sm">Valor mensal: <strong>{brl(PLANS[plan].priceCents)}</strong> (simulado)</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={checkout.isPending}>Cancelar</Button>
          <Button onClick={() => checkout.mutate()} disabled={!/^\S+@\S+\.\S+$/.test(email) || checkout.isPending}>
            {checkout.isPending && <Loader2 className="animate-spin" />} Ir para o Mercado Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionSection({ ws, info }: { ws: string; info: BillingInfo }) {
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const set = (data: BillingInfo) => {
    qc.setQueryData(billingKey(ws), data);
    void qc.invalidateQueries({ queryKey: ["workspaces"] });
  };
  const sync = useMutation({ mutationFn: () => billingApi.sync(ws), onSuccess: set, onError: (e) => toast.error(getErrorMessage(e)) });
  const cancel = useMutation({
    mutationFn: () => billingApi.cancel(ws),
    onSuccess: (d) => {
      set(d);
      toast.success("Assinatura cancelada");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const sub = info.subscription;
  const pending = sub?.status === "pending";
  // Ao voltar do checkout, o webhook pode demorar (ou não alcançar um ambiente local): consulta o provedor.
  useEffect(() => {
    if (pending && info.available) sync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir a página / mudar de assinatura
  }, [sub?.id, pending, info.available]);

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold">Assinatura</h2>
        {info.available && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Modo de teste — sem cobrança real
          </span>
        )}
      </div>
      {!info.available ? (
        <p className="text-sm text-muted-foreground">O pagamento online ainda não foi configurado neste ambiente. Fale com a equipe do Andamo para mudar de plano.</p>
      ) : !sub || (sub.status === "cancelled" && (!sub.endsAt || Date.parse(sub.endsAt) <= Date.now())) ? (
        <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa. Escolha um plano abaixo para testar o fluxo de assinatura.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <p>
            <strong>{PLANS[sub.plan].name}</strong> · {brl(sub.amountCents)}/mês · {STATUS[sub.status]}
          </p>
          {sub.status === "authorized" && sub.nextPaymentAt && <p className="text-muted-foreground">Próxima cobrança (de teste): {formatDate(sub.nextPaymentAt.slice(0, 10))}</p>}
          {sub.status === "cancelled" && sub.endsAt && <p className="text-muted-foreground">O plano {PLANS[sub.plan].name} continua até {formatDate(sub.endsAt.slice(0, 10))}; depois o workspace volta ao Free, sem perder dados.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {(pending || sub.status === "paused") && (
              <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
                {sync.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Verificar status
              </Button>
            )}
            {sub.status !== "cancelled" && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmCancel(true)}>
                Cancelar assinatura
              </Button>
            )}
          </div>
        </div>
      )}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar a assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              A assinatura é cancelada no Mercado Pago (ambiente de teste). O plano pago continua até o fim do ciclo atual e depois o workspace volta ao Free. Nenhum dado é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate()}>Cancelar assinatura</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
