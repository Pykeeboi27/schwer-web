/**
 * Shared field styling for native form controls (textarea, select) that need to
 * visually match the shadcn `Input`. Previously this exact string was
 * copy-pasted across the quotation and costing dialogs.
 */
export const fieldClassName =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Textarea variant — same as {@link fieldClassName} with a comfortable default top margin. */
export const textareaClassName = `mt-1 ${fieldClassName}`;

/**
 * Native `<select>` variant. `fieldClassName`'s transparent background is fine
 * for text inputs (the surrounding dialog shows through), but a native
 * `<select>`'s dropdown list is rendered by the browser outside the app's DOM —
 * without an explicit background it falls back to the browser default (usually
 * opaque white), while the text color still inherits the app's theme. In dark
 * mode that produced white text on a white popup. Force both colors instead of
 * leaving the background transparent.
 */
export const selectFieldClassName = `${fieldClassName} bg-background text-foreground`;
