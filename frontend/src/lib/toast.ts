import { toast as sonnerToast, type ExternalToast } from "sonner";

export const toast = {
  success: (message: string, opts?: ExternalToast) =>
    sonnerToast.success(message, opts),
  error: (message: string, opts?: ExternalToast) =>
    sonnerToast.error(message, opts),
  info: (message: string, opts?: ExternalToast) => sonnerToast.info(message, opts),
  warning: (message: string, opts?: ExternalToast) =>
    sonnerToast.warning(message, opts),
  promise: <T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string }
  ) => sonnerToast.promise(promise, msgs),
  dismiss: sonnerToast.dismiss,
};
