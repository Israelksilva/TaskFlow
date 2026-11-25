import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  /** Sem `to`, o item é a página atual. */
  to?: string;
}

/** Trilha de navegação. O último item é a página atual (`aria-current="page"`). */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li className={cn("min-w-0", !last && "hidden sm:block")}>
                {item.to && !last ? (
                  <Link to={item.to} className="truncate rounded-sm transition-colors hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className="block truncate font-medium text-foreground">
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden className="hidden sm:block">
                  <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
