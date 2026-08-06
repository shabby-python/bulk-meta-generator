"use client";

import { useRef, useState } from "react";
import { parseCsvUrls, type ParseCsvResult } from "@/lib/csv/parse";

interface CsvUploadProps {
  onParsed: (result: ParseCsvResult, fileName: string) => void;
  disabled?: boolean;
}

export default function CsvUpload({ onParsed, disabled }: CsvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File) {
    const text = await file.text();
    const result = parseCsvUrls(text);
    setFileName(file.name);
    if (!result.urlColumn) {
      setSummary("No URL column found. Add a column named \"url\" or a column of valid URLs.");
    } else {
      setSummary(
        `Found ${result.urls.length} URL${result.urls.length === 1 ? "" : "s"} in column "${result.urlColumn}"` +
          (result.skippedRows > 0 ? ` (${result.skippedRows} row${result.skippedRows === 1 ? "" : "s"} skipped)` : "")
      );
    }
    onParsed(result, file.name);
  }

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">Upload CSV</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={`flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-zinc-300 bg-zinc-50"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-zinc-400">
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-sm text-zinc-500">
          Drag a CSV here, or{" "}
          <button
            type="button"
            className="font-medium text-blue-600 hover:underline"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            browse
          </button>
        </p>
        <p className="text-xs text-zinc-400">Column named &quot;url&quot; expected; extra columns are preserved on export.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        {fileName && (
          <div className="mt-1 rounded-md bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm">
            <span className="font-medium">{fileName}</span>
            {summary && <div className="text-zinc-500">{summary}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
