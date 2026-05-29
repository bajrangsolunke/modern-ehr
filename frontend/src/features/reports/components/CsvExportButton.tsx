import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  disabled?: boolean;
}

function escape(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function CsvExportButton({ filename, headers, rows, disabled }: Props) {
  function handleExport() {
    const lines = [
      headers.map(escape).join(","),
      ...rows.map((row) => row.map(escape).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleExport} disabled={disabled}>
      <Download className="size-3.5 mr-1.5" />
      Export CSV
    </Button>
  );
}
