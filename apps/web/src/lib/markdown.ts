/**
 * Markdown seguro e minimalista para descrições e comentários.
 * Estratégia anti-XSS: o texto é ESCAPADO antes de qualquer marcação; só geramos um
 * conjunto fixo de tags, e links aceitam apenas http(s)/mailto.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[0.85em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/@\[([^\]]{1,80})\]\([0-9a-f-]{36}\)/gi, '<span class="rounded bg-primary/10 px-1 font-medium text-primary">@$1</span>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer nofollow" class="text-primary underline underline-offset-2">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer nofollow" class="text-primary underline underline-offset-2">$2</a>');
}

export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).split(/\r?\n/);
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(?:\[( |x)\]\s+)?(.*)$/i.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length + 2;
      out.push(`<h${level} class="font-semibold mt-3 mb-1">${inline(heading[2])}</h${level}>`);
    } else if (bullet) {
      if (list !== "ul") {
        closeList();
        out.push('<ul class="ml-5 list-disc space-y-0.5">');
        list = "ul";
      }
      const box = bullet[1] === undefined ? "" : bullet[1].toLowerCase() === "x" ? "☑ " : "☐ ";
      out.push(`<li>${box}${inline(bullet[2])}</li>`);
    } else if (ordered) {
      if (list !== "ol") {
        closeList();
        out.push('<ol class="ml-5 list-decimal space-y-0.5">');
        list = "ol";
      }
      out.push(`<li>${inline(ordered[1])}</li>`);
    } else if (/^&gt;\s?/.test(line)) {
      closeList();
      out.push(`<blockquote class="border-l-2 border-primary/40 pl-3 text-muted-foreground">${inline(line.replace(/^&gt;\s?/, ""))}</blockquote>`);
    } else if (line.trim() === "") {
      closeList();
      out.push('<div class="h-2"></div>');
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("");
}

/** Texto puro (sem marcação de menção) para resumos e notificações. */
export function plainText(source: string): string {
  return source.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, "@$1").replace(/[*_`~#>]/g, "");
}
