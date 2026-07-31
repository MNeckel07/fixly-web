"use client";

import { useEffect, useRef } from "react";

/**
 * Entrada do código de 6 dígitos: um quadradinho por dígito, com colar
 * (Ctrl+V do e-mail) e navegação por backspace/setas.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setAt(i: number, char: string) {
    const next = (value.padEnd(6, " ").slice(0, 6).split("") as string[]);
    next[i] = char;
    const joined = next.join("").replace(/\s/g, "");
    onChange(joined);
    if (char && i < 5) refs.current[i + 1]?.focus();
    if (joined.length === 6 && onComplete) onComplete(joined);
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={(e) => {
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (!text) return;
      e.preventDefault();
      onChange(text);
      refs.current[Math.min(text.length, 5)]?.focus();
      if (text.length === 6 && onComplete) onComplete(text);
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d.trim()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Dígito ${i + 1} do código`}
          onChange={(e) => {
            const c = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, c);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d.trim() && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          className="h-14 w-11 sm:w-12 rounded-xl border border-black/10 bg-white text-center text-xl font-bold text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:bg-canvas disabled:text-gray-light"
        />
      ))}
    </div>
  );
}
