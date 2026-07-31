'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { tapTarget } from '@/lib/ui';

// Toggle de tema: escribe la cookie `theme` (para el SSR sin flash en la próxima
// carga) y togglea la clase .dark en <html> para feedback inmediato.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.cookie = `theme=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className={`flex ${tapTarget} h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground`}
    >
      {/* Evita mismatch de hidratación: no muestra ícono hasta montar */}
      {mounted ? (
        dark ? (
          <Sun className="h-4 w-4" aria-hidden />
        ) : (
          <Moon className="h-4 w-4" aria-hidden />
        )
      ) : (
        <span className="h-4 w-4" />
      )}
    </button>
  );
}
