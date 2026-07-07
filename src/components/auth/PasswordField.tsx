"use client";

import { useState } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { checkPassword } from "@/lib/password";

/** Campo de senha com botão de olho e (opcional) checklist de força. */
export function PasswordField({
  value,
  onChange,
  showStrength = false,
  placeholder = "••••••••",
  autoComplete = "current-password",
  required = true,
}: {
  value: string;
  onChange: (v: string) => void;
  showStrength?: boolean;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const checks = showStrength ? checkPassword(value) : [];

  return (
    <div>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-light hover:text-ink"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? "text-success" : "text-gray"}`}>
              {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-gray-light" />}
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
