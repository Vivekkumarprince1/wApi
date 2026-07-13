import type { Metadata } from "next";
import { ReviewForm } from "@/components/review-form";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Submit Review",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SubmitReviewPage() {
  await requireUser({ from: "/reviews/submit", employeeOnly: true });

  return (
    <div className="container-page py-8">
      <ReviewForm />
    </div>
  );
}
