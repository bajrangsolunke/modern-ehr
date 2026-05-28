/**
 * Full-page 4-field SOAP editor.
 * Displays as a Card with labeled textareas for S/O/A/P.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

export interface SoapValues {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface SoapEditorProps {
  values: SoapValues;
  onChange: (values: SoapValues) => void;
  errors?: Partial<Record<keyof SoapValues, string>>;
}

const FIELDS: Array<{
  key: keyof SoapValues;
  label: string;
  hint: string;
  placeholder: string;
}> = [
  {
    key: "subjective",
    label: "Subjective",
    hint: "Patient-reported symptoms, history of present illness, ROS.",
    placeholder:
      "e.g. Patient reports 3-day history of substernal chest pressure, worse on exertion…",
  },
  {
    key: "objective",
    label: "Objective",
    hint: "Exam findings, vitals, labs, imaging. Document after exam.",
    placeholder:
      "Document after exam — e.g. BP 142/88, HR 92, afebrile. ECG sinus rhythm…",
  },
  {
    key: "assessment",
    label: "Assessment",
    hint: "Clinical impression, differential, working diagnosis.",
    placeholder:
      "Document after exam — e.g. Suspected unstable angina; rule out NSTEMI…",
  },
  {
    key: "plan",
    label: "Plan",
    hint: "Orders, medications, procedures, follow-up, patient education.",
    placeholder:
      "Document after assessment — e.g. Trend troponin q3h, start aspirin 325 mg, cardiology consult…",
  },
];

export function SoapEditor({ values, onChange, errors }: SoapEditorProps) {
  const handleChange = (key: keyof SoapValues) => (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    onChange({ ...values, [key]: e.target.value });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>SOAP note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        {FIELDS.map(({ key, label, hint, placeholder }) => (
          <FormField
            key={key}
            label={label}
            htmlFor={`soap-${key}`}
            hint={hint}
            error={errors?.[key]}
          >
            <Textarea
              id={`soap-${key}`}
              rows={4}
              placeholder={placeholder}
              value={values[key]}
              onChange={handleChange(key)}
            />
          </FormField>
        ))}
      </CardContent>
    </Card>
  );
}
