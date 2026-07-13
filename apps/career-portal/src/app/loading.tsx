import { LoadingBlock } from "@/components/ui";

export default function Loading() {
  return (
    <div className="container-page py-8">
      <LoadingBlock title="Loading careers workspace" rows={6} />
    </div>
  );
}
