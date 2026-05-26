import { ArrowUpRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { aiInsights } from "@/data/mock";

export function AiRecommendations() {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -top-10 -right-10 size-40 rounded-full bg-primary/10 blur-3xl" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary-gradient grid place-items-center text-white">
              <Sparkles className="size-3.5" />
            </div>
            <h3 className="font-semibold text-sm">AI Recommendations</h3>
            <Badge variant="default" size="sm">3 new</Badge>
          </div>
          <Button variant="ghost" size="xs" className="text-primary">
            View all <ArrowUpRight className="size-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-3 pb-5">
        {aiInsights.slice(0, 3).map((i, idx) => (
          <motion.div
            key={i.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-3 rounded-xl bg-surface-subtle border border-border/60 hover:border-primary/30 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm leading-tight">{i.title}</h4>
              <Badge variant="outline" size="sm">
                {Math.round(i.confidence * 100)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              {i.summary}
            </p>
            {i.actions && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {i.actions.map((a) => (
                  <Button key={a} size="xs" variant="soft">
                    {a}
                  </Button>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
