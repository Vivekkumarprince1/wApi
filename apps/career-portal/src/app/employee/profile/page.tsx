import type { Metadata } from "next";
import { EmployeeProfilePanel } from "@/components/employee-profile-panel";
import {
  employees,
  getReviewEligibility,
  jobs,
  listApplicationsForRecommendation,
  listRecommendationsByUser,
} from "@/lib/career-store";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Employee Profile",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EmployeeProfilePage() {
  const user = await requireUser({ from: "/employee/profile", employeeOnly: true });
  const employee = employees.find((item) => item.email.toLowerCase() === user.email.toLowerCase());

  return (
    <div className="container-page py-8">
      <EmployeeProfilePanel
        user={user}
        employee={employee}
        initialRecommendations={listRecommendationsByUser(user.name)}
        applications={listApplicationsForRecommendation(user)}
        jobs={jobs}
        reviewEligibility={getReviewEligibility(user)}
      />
    </div>
  );
}
