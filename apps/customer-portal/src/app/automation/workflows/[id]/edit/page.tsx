import { redirect } from 'next/navigation';

export default async function WorkflowEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/automation/workflows/builder/${id}`);
}
