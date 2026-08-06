"use client";

import { useEffect, useRef, useState } from "react";

interface EditableMetaFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLength: number;
  maxLength: number;
  disabled?: boolean;
}

export default function EditableMetaField({
  value,
  onChange,
  placeholder,
  minLength,
  maxLength,
  disabled,
}: EditableMetaFieldProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }

  const len = draft.length;
  const lenColor = len === 0 ? "text-zinc-400" : len < minLength || len > maxLength ? "text-amber-600" : "text-emerald-600";

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={startEditing}
        className="group block w-full min-w-[220px] max-w-[360px] rounded-md border border-transparent px-2 py-1 text-left text-sm hover:border-zinc-200 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {value ? (
          <span className="line-clamp-2 text-zinc-800">{value}</span>
        ) : (
          <span className="text-zinc-400">{placeholder}</span>
        )}
      </button>
    );
  }

  return (
    <div className="w-full min-w-[260px] max-w-[400px]">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        rows={2}
        className="w-full resize-none rounded-md border border-blue-400 px-2 py-1 text-sm text-zinc-800 outline-none ring-2 ring-blue-100"
      />
      <div className={`mt-0.5 text-right text-[11px] tabular-nums ${lenColor}`}>{len} chars</div>
    </div>
  );
}
