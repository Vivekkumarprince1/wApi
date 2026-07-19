import assert from "node:assert/strict";
import test from "node:test";

import { detectChanges, services } from "./changed-services.mjs";

test("an auth-service change selects only auth-service", () => {
  assert.deepEqual(detectChanges(["services/auth-service/src/index.ts"]).serviceNames, ["auth-service"]);
});

test("a career portal change selects only career-portal", () => {
  assert.deepEqual(detectChanges(["apps/career-portal/src/app/page.tsx"]).serviceNames, ["career-portal"]);
});

test("contracts select only contract consumers", () => {
  const result = detectChanges(["packages/contracts/src/index.ts"]);
  assert.equal(result.serviceNames.includes("career-portal"), false);
  assert.equal(result.serviceNames.includes("customer-portal"), false);
  assert.equal(result.serviceNames.includes("auth-service"), true);
});

test("Helm changes update GitOps without rebuilding images", () => {
  const result = detectChanges(["deploy/helm/connectsphere/templates/deployments.yaml"]);
  assert.equal(result.hasServices, false);
  assert.equal(result.shouldUpdateGitOps, true);
});

test("force all selects every deployable service", () => {
  assert.equal(detectChanges([], true).services.length, services.length);
});

test("root Docker context changes rebuild every image", () => {
  assert.equal(detectChanges([".dockerignore"]).services.length, services.length);
});

test("deployment workflow changes rebuild every image", () => {
  assert.equal(
    detectChanges([".github/workflows/deploy-aks-gitops.yml"]).services.length,
    services.length,
  );
});
