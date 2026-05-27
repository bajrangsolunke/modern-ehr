/**
 * Full-page editor for the multi-section forms (intake + consent).
 * Other form types still use the lightweight FormFillerModal.
 * Route: /forms/:formId/edit
 */
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useFormRequest } from "./hooks/use-forms";
import { IntakeFormEditor } from "./editors/IntakeFormEditor";
import { ConsentFormEditor } from "./editors/ConsentFormEditor";
import { ROUTES } from "@/config/constants";

export function FormEditorPage() {
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();
  const { data: form, isLoading, isError, error, refetch } = useFormRequest(
    formId
  );

  // Use the browser's back history so the editor returns to whatever
  // page launched it (Forms list, patient profile, search results,
  // direct deep-link, etc.). If there's no history we land on the
  // Forms list as a safe default.
  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(ROUTES.forms);
    }
  };

  if (isLoading) {
    return (
      <div className="grid place-items-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner
        title="Couldn't load form"
        message={error instanceof Error ? error.message : "Please try again."}
        onRetry={() => refetch()}
      />
    );
  }

  if (!form) return null;

  if (form.formType === "intake") {
    return <IntakeFormEditor form={form} onClose={goBack} />;
  }
  if (form.formType === "consent") {
    return <ConsentFormEditor form={form} onClose={goBack} />;
  }

  // Other form types shouldn't land here — they use the modal filler.
  // Redirect back so the user isn't stuck.
  return (
    <ErrorBanner
      title="This form uses the quick filler"
      message="Open the form from the Forms page and use the inline modal."
      onRetry={goBack}
    />
  );
}
