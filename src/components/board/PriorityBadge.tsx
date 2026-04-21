import { Priority, PRIORITY_LABELS } from "@/types/board";
import { cn } from "@/lib/utils";

const styles: Record<Priority, string> = {
  alta: "bg-destructive/10 text-destructive ring-destructive/20",
  media: "bg-warning/15 text-warning-foreground ring-warning/30",
  baixa: "bg-success/10 text-success ring-success/20",
};

export const PriorityBadge = ({ priority }: { priority: Priority }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
        styles[priority]
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          priority === "alta" && "bg-destructive",
          priority === "media" && "bg-warning",
          priority === "baixa" && "bg-success"
        )}
      />
      {PRIORITY_LABELS[priority]}
    </span>
  );
};
