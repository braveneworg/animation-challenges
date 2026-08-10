interface WorkspacePageProps {
  categoryId: string;
  slug: string;
}

export function WorkspacePage({ categoryId, slug }: WorkspacePageProps): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
      <p className="font-mono text-sm">{`${categoryId}/${slug}`}</p>
    </section>
  );
}
