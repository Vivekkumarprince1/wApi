import { redirect } from 'next/navigation';

export default function WorkflowCreateRedirectPage() {
  redirect('/dashboard/automation/workflows/builder/create');
}
