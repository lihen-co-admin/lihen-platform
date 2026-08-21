import { PageHeader } from '../components/PageHeader';

export function DashboardPage() {
  return (
    <section>
      <PageHeader
        title="Dashboard"
        description="Base del nuevo Control Center. Los módulos operativos se incorporarán por slices verticales probados."
      />
      <div className="card-grid">
        <article className="card">
          <span className="card-label">Estado</span>
          <strong>Bootstrap activo</strong>
          <p>Sin migraciones de producción y sin escrituras sobre datos reales.</p>
        </article>
        <article className="card">
          <span className="card-label">Siguiente</span>
          <strong>Product Create Slice</strong>
          <p>Crear productos de forma segura en memoria mientras la escritura Supabase DEV permanece bloqueada por el precheck.</p>
        </article>
      </div>
    </section>
  );
}
