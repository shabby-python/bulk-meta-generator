"use client";

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function UrlInput({ value, onChange, disabled }: UrlInputProps) {
  const lineCount = value.split(/\r?\n/).filter((l) => l.trim()).length;

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor="url-textarea" className="text-sm font-medium text-zinc-700">
          Paste URLs
        </label>
        {lineCount > 0 && <span className="text-xs text-zinc-400">{lineCount} URL{lineCount === 1 ? "" : "s"}</span>}
      </div>
      <textarea
        id="url-textarea"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"Enter URLs — one URL per line\nhttps://example.com/product/red-running-shoes\nhttps://example.com/blog/how-to-do-seo\nhttps://example.com/category/mens-shirts"}
        className="min-h-[160px] w-full flex-1 resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-800 placeholder:font-sans placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-50 disabled:text-zinc-400"
      />
    </div>
  );
}
