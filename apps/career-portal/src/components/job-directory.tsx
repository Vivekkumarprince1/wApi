"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Filter, MapPin, Search } from "lucide-react";
import type { Job } from "@/types/career";
import { Badge, Button, EmptyState, Input, Select, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export function JobDirectory({ jobs }: { jobs: Job[] }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [type, setType] = useState("all");
  const [location, setLocation] = useState("all");

  const departments = useMemo(() => Array.from(new Set(jobs.map((job) => job.department))).sort(), [jobs]);
  const types = useMemo(() => Array.from(new Set(jobs.map((job) => job.type))).sort(), [jobs]);
  const locations = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.location.split("/")[0].trim()))).sort(),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const haystack = [job.title, job.description, job.department, job.location, job.type, job.workMode]
        .join(" ")
        .toLowerCase();
      return (
        (!q || haystack.includes(q)) &&
        (department === "all" || job.department === department) &&
        (type === "all" || job.type === type) &&
        (location === "all" || job.location.toLowerCase().includes(location.toLowerCase()))
      );
    });
  }, [department, jobs, location, query, type]);

  const resetFilters = () => {
    setQuery("");
    setDepartment("all");
    setType("all");
    setLocation("all");
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_190px_160px_180px_auto]">
          <label className="relative block">
            <span className="sr-only">Search roles</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Search title, team, skill, or location"
            />
          </label>
          <label>
            <span className="sr-only">Department</span>
            <Select value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="all">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Employment type</span>
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">All types</option>
              {types.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Location</span>
            <Select value={location} onChange={(event) => setLocation(event.target.value)}>
              <option value="all">All locations</option>
              {locations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </label>
          <Button type="button" variant="outline" className="w-full sm:col-span-2 xl:col-span-1 xl:w-auto" onClick={resetFilters}>
            <Filter className="size-4" aria-hidden="true" />
            Reset
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{filteredJobs.length} active role{filteredJobs.length === 1 ? "" : "s"}</span>
          {query ? <Badge className="bg-muted">Search: {query}</Badge> : null}
          {department !== "all" ? <Badge className="bg-muted">{department}</Badge> : null}
          {type !== "all" ? <Badge className="bg-muted">{type}</Badge> : null}
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <EmptyState
          title="No roles match these filters"
          description="Try a broader search, or create a candidate account to keep your profile ready for new openings."
          actionHref="/register"
          actionLabel="Sign up"
        />
      ) : (
        <div className="grid gap-3">
          {filteredJobs.map((job) => (
            <article key={job.id} className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-white">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">{job.department}</Badge>
                    <Badge className="bg-muted">{job.type}</Badge>
                    <Badge className="bg-muted">{job.workMode}</Badge>
                  </div>
                  <h2 className="safe-text mt-3 text-lg font-semibold tracking-tight">
                    <Link href={`/jobs/${job.slug}`} className="hover:text-primary">
                      {job.title}
                    </Link>
                  </h2>
                  <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-muted-foreground">{job.description}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {job.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BriefcaseBusiness className="size-3.5" aria-hidden="true" />
                      {job.salary}
                    </span>
                    <span>Posted {formatDate(job.createdAt)}</span>
                    <span>{job.applicantCount} applicants</span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                  <StatusBadge status="valid" />
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={`/jobs/${job.slug}`}>
                      View role
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
