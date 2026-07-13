"use client";

import { FormEvent, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button, Field, Input, Surface, Textarea } from "@/components/ui";
import { contactSchema } from "@/lib/validators";

export function ContactForm() {
  const [values, setValues] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = contactSchema.safeParse(values);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message])));
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result.data),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error?.message || "Message could not be queued.");
      }
      setSubmitted(true);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Message could not be queued." });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Surface className="p-5">
        <h1 className="text-xl font-semibold">Message queued</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          HR will reply from the configured support inbox. In production this action writes an audit event and sends email through the outbox.
        </p>
      </Surface>
    );
  }

  return (
    <Surface className="p-5">
      <form onSubmit={submit} className="grid gap-4">
        {errors.form ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{errors.form}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Name" error={errors.name}>
            <Input id="name" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <Field id="email" label="Email" error={errors.email}>
            <Input id="email" value={values.email} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} />
          </Field>
        </div>
        <Field id="subject" label="Subject" error={errors.subject}>
          <Input id="subject" value={values.subject} onChange={(event) => setValues((current) => ({ ...current, subject: event.target.value }))} />
        </Field>
        <Field id="message" label="Message" error={errors.message}>
          <Textarea id="message" value={values.message} onChange={(event) => setValues((current) => ({ ...current, message: event.target.value }))} />
        </Field>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          Send message
        </Button>
      </form>
    </Surface>
  );
}
