const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

/** Leitura simples do user-agent: navegador e sistema, sem biblioteca. */
export function describeUserAgent(ua: string | null) {
  if (!ua) return { label: "Dispositivo desconhecido", mobile: false };
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? "Navegador";
  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  return { label: os ? `${browser} no ${os}` : browser, mobile: /Mobi|Android|iPhone/.test(ua) };
}
