interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="page-header">
      <p className="eyebrow">LIHEN CONTROL CENTER</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
