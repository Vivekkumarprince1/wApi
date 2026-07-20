const staticAssetPattern =
  /\.(?:ico|png|jpg|jpeg|svg|webp|gif|css|js|txt|xml|json|map)$/;

export function isPublicAdminPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/auth/google/callback" ||
    pathname === "/health" ||
    pathname.startsWith("/api/") ||
    staticAssetPattern.test(pathname)
  );
}
