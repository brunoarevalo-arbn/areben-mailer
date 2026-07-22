// Página pública de desuscripción. El token real se implementa con el motor de envío.
export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await searchParams;
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", fontFamily: "system-ui", padding: 24 }}>
      <h1 style={{ fontSize: 22 }}>Desuscripción</h1>
      <p style={{ color: "#666", lineHeight: 1.5 }}>
        Tu pedido de baja fue registrado. No vas a recibir más emails de esta lista.
      </p>
    </div>
  );
}
