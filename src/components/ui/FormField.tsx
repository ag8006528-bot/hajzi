import { cloneElement, isValidElement, type ReactElement } from 'react';

/** Label + control + error message, wired up with aria attributes. */
export function FormField({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })
    : children;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {optional && <span className="font-normal text-ink/60">{optional}</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink/65">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
