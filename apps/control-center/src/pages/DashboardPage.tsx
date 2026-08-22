import { PageHeader } from '../components/PageHeader';

export function DashboardPage() {
  return (
    <section>
      <PageHeader
        title="Dashboard"
        description="LIHEN Control Center avanza por slices verticales validados contra Supabase DEV."
      />
      <div className="card-grid">
        <article className="card">
          <span className="card-label">Fase 2.1</span>
          <strong>Auth + Admin Profile + RLS: PASS</strong>
          <p>La sesión requiere perfil ACTIVE y rol reconocido antes de abrir el Control Center.</p>
        </article>
        <article className="card">
          <span className="card-label">Fase 2.2</span>
          <strong>Product Create Slice</strong>
          <p>CreateProduct usa un RPC controlado en Supabase DEV. Las escrituras directas sobre products permanecen revocadas.</p>
        </article>
      </div>
    </section>
  );
}
