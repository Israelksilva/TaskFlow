import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Símbolo do Andamo: um "A" cuja perna direita se completa num check —
 * o trabalho em andamento que chega ao "concluído".
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-8 w-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D5DFC" />
          <stop offset="1" stopColor="#A646F0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <path d="M17 48 31 17" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M31 17 36.5 29" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" opacity=".55" />
      <path
        d="m26 38.5 6 5.5 15-16"
        fill="none"
        stroke="#FF8A65"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="font-display text-xl font-extrabold tracking-tight">Andamo</span>
    </span>
  );
}
