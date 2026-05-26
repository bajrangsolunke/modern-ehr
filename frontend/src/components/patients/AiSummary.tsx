import { Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AiSummary({ summary }: { summary: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="relative overflow-hidden border-primary/30">
        <div className="absolute -top-12 -right-12 size-40 rounded-full bg-primary/20 blur-3xl" />
        <CardContent className="p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-primary-gradient grid place-items-center text-white">
                <Sparkles className="size-3.5" />
              </div>
              <h3 className="font-semibold text-sm">AI clinical summary</h3>
              <Badge variant="default" size="sm">Beta</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="size-7">
                <ThumbsUp className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7">
                <ThumbsDown className="size-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">{summary}</p>
          <div className="mt-3 flex gap-1.5 flex-wrap">
            <Button size="xs" variant="soft">Regenerate</Button>
            <Button size="xs" variant="soft">Open SOAP</Button>
            <Button size="xs" variant="soft">Copy to note</Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
