import React, { useEffect, useState } from 'react';

type ToastItem = {
  id: number;
  message: string;
};

let nextId = 1;
const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];

export function toast(message: string) {
  const id = nextId++;
  const item: ToastItem = { id, message };
  items = [...items, item];
  for (const l of listeners) l(items);

  window.setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    for (const l of listeners) l(items);
  }, 1400);
}

export function ToastHost() {
  const [current, setCurrent] = useState<ToastItem[]>(items);

  useEffect(() => {
    const l = (next: ToastItem[]) => setCurrent(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (current.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
      {current.map((t) => (
        <div
          key={t.id}
          className="rounded-lg border border-slate-700 bg-slate-900/95 backdrop-blur px-3 py-2 text-sm text-slate-100 shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
