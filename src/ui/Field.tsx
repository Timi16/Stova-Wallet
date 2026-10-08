import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: ReactNode;
  right?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
}

export function Field({ label, right, error, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {right}
      </div>
      {children(id)}
      {error && (
        <span role="alert" className="error-text">
          {error}
        </span>
      )}
      {!error && hint && <span className="hint">{hint}</span>}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { bad?: boolean; mono?: boolean };
export function Input({ bad, mono, className = '', ...rest }: InputProps) {
  return <input {...rest} className={`input ${bad ? 'input-bad' : ''} ${mono ? 'font-mono text-sm' : ''} ${className}`} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { bad?: boolean };
export function Textarea({ bad, className = '', ...rest }: TextareaProps) {
  return <textarea {...rest} className={`input h-auto resize-none py-3.5 leading-relaxed ${bad ? 'input-bad' : ''} ${className}`} />;
}

/** Password input with Show / Hide. */
export function PasswordInput({ bad, className = '', ...rest }: InputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...rest} type={show ? 'text' : 'password'} className={`input pr-[70px] ${bad ? 'input-bad' : ''} ${className}`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1.5 top-1 h-11 px-3 text-[13px] font-semibold text-accent"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
