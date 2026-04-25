import { redirect } from 'next/navigation';

export default async function WorkflowEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/automation/workflows/builder/${id}`);
}
