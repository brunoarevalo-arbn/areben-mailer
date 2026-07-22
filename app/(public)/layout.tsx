// Layout minimalista para páginas públicas (login, baja). Sin sidebar,
// sin getCuentaActiva; centrado en el canvas.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      {children}
    </div>
  );
}
