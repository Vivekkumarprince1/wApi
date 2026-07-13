import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Button, MetricTile, SectionHeader, Surface } from "@/components/ui";
import { featuredJobs, getApprovedReviews, listJobs } from "@/lib/career-store";
import { formatDate } from "@/lib/utils";

export default function HomePage() {
  const jobs = listJobs();
  const roles = featuredJobs();
  const reviews = getApprovedReviews();

  return (
    <div>
      <section className="border-b bg-background">
        <div className="container-page grid items-center gap-6 py-8 sm:gap-8 lg:min-h-[calc(100vh-56px)] lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="max-w-3xl">
            <Badge className="bg-muted">ConnectSphere Careers</Badge>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
              Build customer operations products with clear ownership.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Browse open roles, apply with a candidate account, track your application, and verify issued documents from the same career portal.
            </p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/jobs">
                  Browse jobs
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/register">Create candidate account</Link>
              </Button>
            </div>
            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              <MetricTile label="Open roles" value={jobs.length} detail="Active hiring pipelines" icon={<BriefcaseBusiness className="size-4" />} />
              <MetricTile label="Verification" value="2" detail="Offer and certificate lookup" icon={<ShieldCheck className="size-4" />} />
              <MetricTile label="Reviews" value={reviews.length} detail="Approved employee feedback" icon={<MessageSquareText className="size-4" />} />
            </dl>
          </div>

          <Surface className="overflow-hidden">
            <Image
              src="/images/careers-banner.png"
              width={900}
              height={720}
              alt="ConnectSphere team workspace"
              className="aspect-[4/3] w-full object-cover"
              priority
            />
            <div className="border-t p-4">
              <p className="text-sm font-semibold">Candidate-first workflow</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Applications require login, while public document verification remains available for third-party checks.
              </p>
            </div>
          </Surface>
        </div>
      </section>

      <section className="border-b bg-card py-10">
        <div className="container-page">
          <SectionHeader
            eyebrow="Open roles"
            title="Current hiring priorities"
            description="Each role includes responsibilities, requirements, screening questions, HR contact, and secure application routing."
            action={
              <Button asChild variant="outline">
                <Link href="/jobs">View all roles</Link>
              </Button>
            }
          />
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {roles.map((job) => (
              <article key={job.id} className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">{job.department}</Badge>
                  <Badge className="bg-muted">{job.workMode}</Badge>
                </div>
                <h2 className="mt-3 text-lg font-semibold">{job.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{job.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{job.location}</span>
                  <span>{formatDate(job.createdAt)}</span>
                </div>
                <Button asChild className="mt-4 w-full" variant="outline">
                  <Link href={`/jobs/${job.slug}`}>Open role</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="container-page grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeader
              eyebrow="Portal features"
              title="Reference app flows, rebuilt as a Next workbench"
              description="The portal covers public discovery, authenticated applications, candidate tracking, offer acceptance, verification, reviews, referrals, and HR operations."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Resume and screening question application flow",
              "Candidate application tracker with notifications",
              "Offer and certificate verification lookup",
              "Role and permission gated HR workbench",
            ].map((item) => (
              <div key={item} className="rounded-lg border bg-card p-4">
                <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-10">
        <div className="container-page">
          <SectionHeader eyebrow="Feedback" title="Employee and candidate reviews" />
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {reviews.map((review) => (
              <figure key={review.id} className="rounded-lg border bg-background p-4">
                <div className="flex items-center gap-1 text-amber-600" aria-label={`${review.rating} star rating`}>
                  {Array.from({ length: review.rating }).map((_, index) => (
                    <Sparkles key={index} className="size-4" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="mt-3 text-sm text-muted-foreground">"{review.body}"</blockquote>
                <figcaption className="mt-4 text-sm font-medium">
                  {review.anonymous ? "Anonymous" : review.name}
                  <span className="block text-xs font-normal text-muted-foreground">{review.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
