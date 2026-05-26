import { ChevronDown, Download, Eye, FileText, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

const sections = [
  {
    name: "Consent & Legal",
    open: true,
    items: [
      { name: "Consent form.txt", type: "txt", color: "text-info" },
      { name: "Risk certification.pdf", type: "pdf", color: "text-danger" },
      { name: "DNRForm.txt", type: "txt", color: "text-info" },
    ],
  },
  {
    name: "Diagnostics",
    open: true,
    items: [
      { name: "Labs12.05.pdf", type: "pdf", color: "text-danger" },
      { name: "X-rayPelvis.txt", type: "txt", color: "text-info" },
    ],
  },
  { name: "Medication & Risk", open: false, items: [] },
];

export function KeyDocuments() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Key documents</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Upload document"
          title="Upload document"
          onClick={() =>
            toast.info("Document uploads coming soon", {
              description:
                "Drag-and-drop uploads land alongside the documents tab in the next release.",
            })
          }
        >
          <Plus className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="pb-5 space-y-3">
        {sections.map((sec) => (
          <div key={sec.name}>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-primary mb-2">
              <ChevronDown
                className={`size-3.5 transition ${sec.open ? "" : "-rotate-90"}`}
              />
              {sec.name}
            </button>
            <div className="space-y-1.5">
              {sec.items.map((it) => (
                <div
                  key={it.name}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-surface-subtle transition group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className={`size-4 ${it.color}`} />
                    <span className="text-sm truncate">{it.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Preview"
                      title="Preview (coming soon)"
                      onClick={() => toast.info("Document preview coming soon")}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Download"
                      title="Download (coming soon)"
                      onClick={() => toast.info("Document download coming soon")}
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
