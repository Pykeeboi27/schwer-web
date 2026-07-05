/**
 * Shared field styling for native form controls (textarea, select) that need to
 * visually match the shadcn `Input`. Previously this exact string was
 * copy-pasted across the quotation and costing dialogs.
 */
export const fieldClassName =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Textarea variant — same as {@link fieldClassName} with a comfortable default top margin. */
export const textareaClassName = `mt-1 ${fieldClassName}`;
