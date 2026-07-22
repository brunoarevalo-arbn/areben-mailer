import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Automatización" title="Automations" subtitle="Próximamente" />
      <EmptyState
        title="En construcción"
        message="Flujos disparados por eventos de Tiendanube (carrito, compra, bienvenida). Fase 3."
      />
    </div>
  );
}
