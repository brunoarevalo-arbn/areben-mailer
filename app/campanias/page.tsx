import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CampaniasPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Envíos" title="Campañas" subtitle="Próximamente" />
      <EmptyState
        title="En construcción"
        message="Acá va el editor de campañas y el envío por lotes (Fase 1, en curso)."
      />
    </div>
  );
}
