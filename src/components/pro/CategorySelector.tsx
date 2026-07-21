"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCategoriesAction } from "@/lib/pro/actions";

type Cat = { slug: string; label: string };

export function CategorySelector({ categories, selected }: { categories: Cat[]; selected: string[] }) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const toggle = (slug: string) =>
    setChosen((c) => (c.includes(slug) ? c.filter((s) => s !== slug) : [...c, slug]));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const on = chosen.includes(c.slug);
          return (
            <button
              key={c.slug}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.slug)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                on ? "rose-gradient text-[#2A1712]" : "border border-border text-ink hover:border-rose"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const res = await saveCategoriesAction(chosen);
              setMsg(res?.error ?? res?.success ?? null);
              if (!res?.error) router.refresh();
            })
          }
          className="rounded-full rose-gradient px-5 py-2 text-sm font-semibold text-[#2A1712] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save categories"}
        </button>
        {msg && <span className="text-[12px] text-ink-muted">{msg}</span>}
      </div>
    </div>
  );
}
