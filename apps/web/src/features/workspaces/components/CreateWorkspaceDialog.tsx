import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspacesApi } from "../api";
import { useWsMutation, wsKeys } from "../hooks";

export function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const create = useWsMutation((n: string) => workspacesApi.create(n), {
    invalidate: [wsKeys.all],
    success: (ws) => `Workspace “${ws.name}” criado`,
    onSuccess: (ws) => {
      onOpenChange(false);
      setName("");
      navigate(`/app/w/${ws.id}`);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length >= 2 && !create.isPending) create.mutate(name.trim());
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar workspace</DialogTitle>
          <DialogDescription>Um espaço para sua equipe ou organização, com projetos, membros e permissões próprios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Nome</Label>
            <Input id="ws-name" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Agência Horizonte" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={name.trim().length < 2 || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden />} Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
