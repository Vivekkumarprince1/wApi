export default function NotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm text-center">
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The admin portal could not find the requested page.
          </p>
          <a
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Go to dashboard
          </a>
        </div>
      </body>
    </html>
  );
}