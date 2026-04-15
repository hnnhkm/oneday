"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { deleteSavedSearchAction } from "@/lib/actions/saved-searches";

export function DeleteSavedSearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await deleteSavedSearchAction(id);
          router.refresh();
        });
      }}
      className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 flex-shrink-0"
      aria-label="Delete"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}
