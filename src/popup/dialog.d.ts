export type DialogMode = "alert" | "confirm" | "prompt";

interface DialogCommonOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

export interface AlertDialogOptions extends DialogCommonOptions {
  type?: "alert";
  defaultValue?: never;
  placeholder?: never;
}

export interface ConfirmDialogOptions extends DialogCommonOptions {
  type: "confirm";
  defaultValue?: never;
  placeholder?: never;
}

export interface PromptDialogOptions extends DialogCommonOptions {
  type: "prompt";
  defaultValue?: string;
  placeholder?: string;
}

export function showDialog(options: AlertDialogOptions): Promise<true>;
export function showDialog(options: ConfirmDialogOptions): Promise<boolean>;
export function showDialog(options: PromptDialogOptions): Promise<string | null>;
