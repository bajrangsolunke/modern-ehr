export { useForm, Controller, FormProvider, useFormContext } from "react-hook-form";
export type { UseFormReturn, FieldValues, Path, UseFormSetError } from "react-hook-form";
export { zodResolver } from "@hookform/resolvers/zod";
export { z } from "zod";

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api-client";

/**
 * Maps a FastAPI-style ApiError into RHF field errors.
 * Falls back to a top-level form error when the shape isn't recognized.
 * Returns the user-facing message that didn't map to a specific field,
 * so the caller can decide whether to toast/banner it.
 */
export function mapApiError<TForm extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TForm>,
  fieldMap: Partial<Record<string, Path<TForm>>> = {}
): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Something went wrong";
  }

  // FastAPI 422 shape: { detail: [{ loc: ["body","email"], msg: "..." }, ...] }
  const data = error.data as { detail?: unknown } | null;
  if (data && Array.isArray(data.detail)) {
    let unmapped: string | null = null;
    for (const item of data.detail as Array<{ loc?: unknown[]; msg?: string }>) {
      const loc = item.loc ?? [];
      const fieldName = String(loc[loc.length - 1] ?? "");
      const mapped = (fieldMap[fieldName] ?? fieldName) as Path<TForm>;
      const msg = item.msg ?? "Invalid value";
      if (fieldName) {
        setError(mapped, { type: "server", message: msg });
      } else {
        unmapped = msg;
      }
    }
    return unmapped ?? "Please check the form for errors";
  }

  // Plain { detail: "string" } shape — e.g. 401, 409
  if (data && typeof data === "object" && "detail" in data) {
    return String((data as { detail: unknown }).detail);
  }

  return error.message || "Request failed";
}
