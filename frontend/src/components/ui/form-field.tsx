import type { ReactNode } from "react";
import { Field, FieldLabel, FieldError, FieldDescription } from "./field";
import { Input } from "./input";
export function FormField({
  id,
  label,
  value,
  onChange,
  type = "text",
  error,
  description,
  required = false,
  children,
  disabled = false,
}: {
  id: string;
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
  error?: string;
  description?: string;
  required?: boolean;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id} className="text-xs font-normal">
        {label}
        {required ? " *" : ""}
      </FieldLabel>
      {children ?? (
        <Input
          id={id}
          value={value ?? ""}
          type={type}
          onChange={(e) => onChange?.(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${id}-error`
              : description
                ? `${id}-description`
                : undefined
          }
          required={required}
          disabled={disabled}
        />
      )}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : description ? (
        <FieldDescription id={`${id}-description`} className="text-xs">
          {description}
        </FieldDescription>
      ) : null}
    </Field>
  );
}
