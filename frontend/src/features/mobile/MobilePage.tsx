import { PageHeader } from "@/components/layout/PageHeader";
import { MobileFrame } from "@/features/mobile/components/MobileFrame";
import { MobileApp } from "@/features/mobile/components/MobileApp";
import { Badge } from "@/components/ui/badge";

export function MobilePage() {
  return (
    <>
      <PageHeader
        title="Mobile Companion"
        subtitle="Modern-EHR for Patients · iOS / Android preview"
        right={<Badge variant="default">v1.0 preview</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="flex justify-center lg:justify-end">
          <MobileFrame>
            <MobileApp />
          </MobileFrame>
        </div>

        <div className="space-y-4 max-w-md">
          <Feature
            title="AI Health Assistant"
            description="Conversational AI helps patients understand their care plan, answer medication questions, and triage symptoms — escalating to humans when needed."
          />
          <Feature
            title="Medication Adherence"
            description="Smart reminders, photo-based pill verification, and automatic refill nudges. Adherence data flows back to the EHR."
          />
          <Feature
            title="Vitals & Wearables"
            description="HealthKit + Google Fit integration. Continuous vitals stream into the patient timeline so the care team sees real signal."
          />
          <Feature
            title="Lifestyle Monitoring"
            description="Track smoking, alcohol, activity, and mood. Patterns inform the AI risk model and pre-op readiness."
          />
          <Feature
            title="Secure Messaging"
            description="HIPAA-grade messaging with read receipts, escalation paths, and clinical context built-in."
          />
        </div>
      </div>
    </>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
    </div>
  );
}
