import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Mail, MapPin, UserRound } from "lucide-react";
import { Badge, Button, SectionHeader, Surface } from "@/components/ui";
import { getJobBySlug, getRelatedJobs } from "@/lib/career-store";
import { getCurrentUser } from "@/lib/server-auth";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const job = getJobBySlug(slug);
  return {
    title: job ? job.title : "Role unavailable",
    description: job?.description,
    robots: {
      index: Boolean(job),
      follow: Boolean(job),
    },
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = getJobBySlug(slug);
  if (!job) notFound();
  const [relatedJobs, user] = await Promise.all([Promise.resolve(getRelatedJobs(job)), getCurrentUser()]);
  const canApply = user?.role === "user";
  const applyPath = `/apply/${job.slug}`;

  return (
    <div className="container-page py-8">
      <Button asChild variant="ghost">
        <Link href="/jobs">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to jobs
        </Link>
      </Button>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_330px]">
        <article className="space-y-5">
          <Surface className="p-5">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">{job.department}</Badge>
              <Badge className="bg-muted">{job.type}</Badge>
              <Badge className="bg-muted">{job.workMode}</Badge>
            </div>
            <h1 className="safe-text mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{job.title}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">{job.description}</p>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="safe-text flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                {job.location}
              </div>
              <div className="safe-text flex items-center gap-2 text-muted-foreground">
                <BriefcaseBusiness className="size-4 shrink-0" aria-hidden="true" />
                {job.salary}
              </div>
              <div className="safe-text flex items-center gap-2 text-muted-foreground">
                <UserRound className="size-4 shrink-0" aria-hidden="true" />
                Reports to {job.reportingManager}
              </div>
              <div className="safe-text flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                {job.hrContact.email}
              </div>
            </div>
          </Surface>

          <Surface className="p-5">
            <SectionHeader title="What you will do" description="Responsibilities are kept explicit so candidates can self-select before applying." />
            <ul className="mt-4 grid gap-2">
              {job.responsibilities.map((item) => (
                <li key={item} className="rounded-md border bg-background px-3 py-2 text-sm">{item}</li>
              ))}
            </ul>
          </Surface>

          <Surface className="p-5">
            <SectionHeader title="What we are looking for" />
            <ul className="mt-4 grid gap-2">
              {job.requirements.map((item) => (
                <li key={item} className="rounded-md border bg-background px-3 py-2 text-sm">{item}</li>
              ))}
            </ul>
          </Surface>

          <Surface className="p-5">
            <SectionHeader title="Screening questions" description="These questions are included in the application form and validated server-side." />
            <div className="mt-4 grid gap-2">
              {job.questions.map((question) => (
                <div key={question.id} className="rounded-md border bg-background px-3 py-2 text-sm">
                  {question.questionText}
                  {question.required ? <span className="ml-1 text-destructive">*</span> : null}
                </div>
              ))}
            </div>
          </Surface>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <Surface className="p-4">
            <h2 className="text-base font-semibold">{user ? "Apply for this role" : "Sign in to apply"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {user
                ? "Applications create a pending record, prevent duplicates, and show candidate-safe progress."
                : "Create a candidate account or sign in before starting an application."}
            </p>
            {!user ? (
              <div className="mt-4 grid gap-2">
                <Button asChild className="w-full">
                  <Link href={`/login?from=${encodeURIComponent(applyPath)}`}>Login</Link>
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <Link href={`/register?from=${encodeURIComponent(applyPath)}`}>Sign up</Link>
                </Button>
              </div>
            ) : canApply ? (
              <Button asChild className="mt-4 w-full">
                <Link href={applyPath}>Start application</Link>
              </Button>
            ) : (
              <Button disabled className="mt-4 w-full">
                Candidate account required
              </Button>
            )}
          </Surface>
          <Surface className="p-4">
            <h2 className="text-base font-semibold">Role details</h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Posted</dt>
                <dd className="font-medium">{formatDate(job.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Applicants</dt>
                <dd className="font-medium">{job.applicantCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">HR contact</dt>
                <dd className="font-medium">{job.hrContact.name}</dd>
              </div>
            </dl>
          </Surface>
          {relatedJobs.length ? (
            <Surface className="p-4">
              <h2 className="text-base font-semibold">Related roles</h2>
              <div className="mt-3 grid gap-2">
                {relatedJobs.map((related) => (
                  <Link key={related.id} href={`/jobs/${related.slug}`} className="safe-text rounded-md border bg-background px-3 py-2 text-sm hover:border-primary/40">
                    {related.title}
                  </Link>
                ))}
              </div>
            </Surface>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
