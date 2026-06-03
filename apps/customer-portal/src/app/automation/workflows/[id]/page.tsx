import { redirect } from 'next/navigation';

export default async function WorkflowDetailRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/automation/workflows/${id}/view`);
}
