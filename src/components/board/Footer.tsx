import { Github, Linkedin, Heart } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground md:flex-row">
        <p className="flex items-center gap-1.5">
          Desenvolvido com <Heart className="h-3.5 w-3.5 fill-destructive text-destructive" /> por
          <span className="font-semibold text-foreground">Israel Alcantara</span>
        </p>
        <div className="flex items-center gap-4">
          <span className="text-xs">Front-end Developer · Projeto de Portfólio</span>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="rounded-lg p-2 text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              href="https://linkedin.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="rounded-lg p-2 text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
