import type { MetadataRoute } from "next";
import { listJobs } from "@/lib/career-store";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3200").replace(/\/+$/, "");
  const now = new Date();
  const staticRoutes = ["/", "/jobs", "/contact", "/verify", "/verify-offer"];

  return [
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: now,
      changeFrequency: route === "/" ? ("daily" as const) : ("weekly" as const),
      priority: route === "/" ? 1 : 0.7,
    })),
    ...listJobs().map((job) => ({
      url: `${baseUrl}/jobs/${job.slug}`,
      lastModified: new Date(job.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
