import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-3xl font-bold text-charcoal mb-3">
        Página não encontrada
      </h1>
      <p className="text-charcoal-lighter mb-6">
        A página que você procura não existe ou foi removida.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded bg-primary-400 text-white font-medium hover:bg-primary-500 transition-colors"
        >
          Voltar ao início
        </Link>
        <Link
          href="/activities"
          className="inline-block px-5 py-2.5 rounded border border-charcoal-lighter/20 text-charcoal font-medium hover:bg-background-muted transition-colors"
        >
          Explorar atividades
        </Link>
      </div>
    </div>
  );
}
