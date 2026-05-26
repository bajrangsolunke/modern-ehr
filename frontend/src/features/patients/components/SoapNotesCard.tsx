import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { soapNotes } from "@/mocks";
import { formatDate, formatTime } from "@/lib/utils";

export function SoapNotesCard() {
  const note = soapNotes[0];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>SOAP note</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(note.date)} · {formatTime(note.date)} · {note.author}
          </p>
        </div>
        <Button size="sm">
          <Plus className="size-3.5" /> New note
        </Button>
      </CardHeader>
      <CardContent className="pb-5">
        <Tabs defaultValue="S">
          <TabsList>
            <TabsTrigger value="S">Subjective</TabsTrigger>
            <TabsTrigger value="O">Objective</TabsTrigger>
            <TabsTrigger value="A">Assessment</TabsTrigger>
            <TabsTrigger value="P">Plan</TabsTrigger>
          </TabsList>
          <TabsContent value="S">
            <p className="text-sm leading-relaxed">{note.subjective}</p>
          </TabsContent>
          <TabsContent value="O">
            <p className="text-sm leading-relaxed">{note.objective}</p>
          </TabsContent>
          <TabsContent value="A">
            <p className="text-sm leading-relaxed">{note.assessment}</p>
          </TabsContent>
          <TabsContent value="P">
            <p className="text-sm leading-relaxed">{note.plan}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
