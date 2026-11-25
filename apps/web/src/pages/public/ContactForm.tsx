import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import {
  CONTACT_TOPIC_LABELS,
  CONTACT_TOPICS,
  contactSchema,
  type ContactInput,
} from "@andamo/shared";
import { InlineError } from "@/components/feedback/InlineError";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/features/auth/components/FormField";
import { ApiError, apiRequest, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const formSchema = contactSchema.omit({ consent: true, elapsedMs: true }).extend({
  consent: z.boolean().refine((v) => v, "É preciso concordar com a Política de Privacidade"),
});
type FormValues = z.input<typeof formSchema>;

const sendContact = (body: ContactInput) =>
  apiRequest<{ ok: boolean }>("/contato", { method: "POST", body });

export function ContactForm() {
  const openedAt = useRef(Date.now());
  const [sent, setSent] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      topic: "duvida",
      message: "",
      consent: false,
      website: "",
    },
  });
  const { errors } = form.formState;

  const mutation = useMutation({
    mutationFn: sendContact,
    onSuccess: () => {
      setSent(true);
      form.reset();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.details) {
        for (const [field, messages] of Object.entries(error.details)) {
          if (field in form.getValues())
            form.setError(field as keyof FormValues, { message: messages[0] });
        }
      }
    },
  });

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-center rounded-xl border bg-card p-8 text-center animate-fade-in"
      >
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h3 className="mt-3 font-display text-lg font-bold">Mensagem enviada</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Obrigado pelo contato. Responderemos no e-mail informado.
        </p>
        <Button
          variant="outline"
          className="mt-5"
          onClick={() => {
            openedAt.current = Date.now();
            setSent(false);
          }}
        >
          Enviar outra mensagem
        </Button>
      </div>
    );
  }

  const messageId = "contato-mensagem";
  return (
    <form
      noValidate
      aria-label="Formulário de contato"
      className="space-y-4 rounded-xl border bg-card p-5 shadow-xs sm:p-6"
      onSubmit={form.handleSubmit((values) => {
        if (mutation.isPending) return;
        mutation.mutate({ ...values, consent: true, elapsedMs: Date.now() - openedAt.current });
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Nome"
          autoComplete="name"
          error={errors.name?.message}
          {...form.register("name")}
        />
        <FormField
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register("email")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contato-assunto">Assunto</Label>
        <select
          id="contato-assunto"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...form.register("topic")}
        >
          {CONTACT_TOPICS.map((t) => (
            <option key={t} value={t}>
              {CONTACT_TOPIC_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={messageId}>Mensagem</Label>
        <Textarea
          id={messageId}
          rows={5}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? `${messageId}-erro` : undefined}
          className={cn(errors.message && "border-destructive")}
          {...form.register("message")}
        />
        {errors.message && (
          <p id={`${messageId}-erro`} className="text-xs font-medium text-destructive">
            {errors.message.message}
          </p>
        )}
      </div>

      {/* Campo-isca: invisível para pessoas e leitores de tela. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contato-site">Site</label>
        <input
          id="contato-site"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...form.register("website")}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-start gap-2.5">
          <input
            id="contato-consentimento"
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))]"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "contato-consentimento-erro" : undefined}
            {...form.register("consent")}
          />
          <label htmlFor="contato-consentimento" className="text-sm text-muted-foreground">
            Concordo com o uso destes dados para responder ao meu contato, conforme a{" "}
            <Link
              to="/privacidade"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Política de Privacidade
            </Link>
            .
          </label>
        </div>
        {errors.consent && (
          <p id="contato-consentimento-erro" className="text-xs font-medium text-destructive">
            {errors.consent.message}
          </p>
        )}
      </div>

      {mutation.isError &&
        !(mutation.error instanceof ApiError && mutation.error.status === 422) && (
          <InlineError>{getErrorMessage(mutation.error)}</InlineError>
        )}

      <Button
        type="submit"
        variant="brand"
        size="lg"
        className="w-full sm:w-auto"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Send aria-hidden />
        )}
        {mutation.isPending ? "Enviando…" : "Enviar mensagem"}
      </Button>
    </form>
  );
}
