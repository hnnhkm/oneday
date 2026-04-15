import Link from "next/link";

export default function RootNotFound() {
  return (
    <html lang="pt">
      <body>
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-3xl font-bold mb-3">
            Página não encontrada
          </h1>
          <p className="text-gray-500 mb-6">
            A página que você procura não existe ou foi removida.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/pt"
              className="inline-block px-5 py-2.5 rounded bg-orange-400 text-white font-medium hover:bg-orange-500 transition-colors"
            >
              Voltar ao início
            </Link>
            <Link
              href="/pt/activities"
              className="inline-block px-5 py-2.5 rounded border border-gray-200 font-medium hover:bg-gray-50 transition-colors"
            >
              Explorar atividades
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
