export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:pt-14">
      <p className="text-xs uppercase tracking-[0.3em] text-secondary">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl font-semibold text-primary sm:text-5xl">
        {title}
      </h1>
      {children && <p className="mt-3 max-w-xl text-muted-foreground">{children}</p>}
    </div>
  );
}
