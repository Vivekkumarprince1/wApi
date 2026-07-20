import test from "node:test";
import assert from "node:assert/strict";

import { isPublicAdminPath } from "../src/lib/auth/admin-public-path.ts";

test("allows the Google callback to complete before an admin cookie exists", () => {
  assert.equal(isPublicAdminPath("/auth/google/callback"), true);
});

test("keeps admin dashboard routes protected", () => {
  assert.equal(isPublicAdminPath("/"), false);
  assert.equal(isPublicAdminPath("/users"), false);
});
