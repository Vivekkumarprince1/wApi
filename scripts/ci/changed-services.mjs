#!/usr/bin/env node

import { execFileSync } from "node:child_process";

export const services = [
  { name: "api-gateway", dir: "services/api-gateway", needs_contracts: true, image: "api-gateway", dockerfile: "services/api-gateway/Dockerfile" },
  { name: "auth-service", dir: "services/auth-service", needs_contracts: true, image: "auth-service", dockerfile: "services/auth-service/Dockerfile" },
  { name: "campaign-service", dir: "services/campaign-service", needs_contracts: true, image: "campaign-service", dockerfile: "services/campaign-service/Dockerfile" },
  { name: "billing-service", dir: "services/billing-service", needs_contracts: true, image: "billing-service", dockerfile: "services/billing-service/Dockerfile" },
  { name: "service-provider", dir: "services/service-provider", needs_contracts: true, image: "service-provider", dockerfile: "services/service-provider/Dockerfile" },
  { name: "automation-service", dir: "services/automation-service", needs_contracts: true, image: "automation-service", dockerfile: "services/automation-service/Dockerfile" },
  { name: "chat-service", dir: "services/chat-service", needs_contracts: true, image: "chat-service", dockerfile: "services/chat-service/Dockerfile" },
  { name: "contact-service", dir: "services/contact-service", needs_contracts: true, image: "contact-service", dockerfile: "services/contact-service/Dockerfile" },
  { name: "webhook-ingestor", dir: "services/webhook-ingestor", needs_contracts: true, image: "webhook-ingestor", dockerfile: "services/webhook-ingestor/Dockerfile" },
  { name: "websocket-gateway", dir: "services/websocket-gateway", needs_contracts: true, image: "websocket-gateway", dockerfile: "services/websocket-gateway/Dockerfile" },
  { name: "admin-portal", dir: "apps/admin-portal", needs_contracts: true, image: "admin-portal", dockerfile: "apps/admin-portal/Dockerfile" },
  { name: "career-portal", dir: "apps/career-portal", needs_contracts: false, image: "career-portal", dockerfile: "apps/career-portal/Dockerfile" },
  { name: "customer-portal", dir: "apps/customer-portal", needs_contracts: false, image: "customer-portal", dockerfile: "apps/customer-portal/Dockerfile" },
];

const deploymentPaths = [
  "deploy/",
  ".github/workflows/deploy-aks-gitops.yml",
];

const rebuildAllPaths = [
  ".dockerignore",
  "scripts/ci/changed-services.mjs",
  ".github/workflows/ci.yml",
  ".github/workflows/deploy-aks-gitops.yml",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
];

export function detectChanges(files, forceAll = false) {
  const selected = new Set();
  const contractsChanged = files.some((file) => file.startsWith("packages/contracts/"));
  const rebuildAll = forceAll || files.some((file) => rebuildAllPaths.includes(file));

  if (rebuildAll) {
    services.forEach((service) => selected.add(service.name));
  } else {
    for (const service of services) {
      if (files.some((file) => file === service.dir || file.startsWith(`${service.dir}/`))) {
        selected.add(service.name);
      }
      if (contractsChanged && service.needs_contracts) {
        selected.add(service.name);
      }
    }
    if (files.some((file) => file.startsWith("packages/") && !file.startsWith("packages/contracts/"))) {
      services.forEach((service) => selected.add(service.name));
    }
  }

  const changedServices = services.filter((service) => selected.has(service.name));
  const deploymentChanged = files.some((file) => deploymentPaths.some((path) => file === path || file.startsWith(path)));

  return {
    files,
    services: changedServices,
    images: changedServices.map(({ image, dockerfile }) => ({ image, dockerfile })),
    serviceNames: changedServices.map(({ name }) => name),
    hasServices: changedServices.length > 0,
    deploymentChanged,
    shouldUpdateGitOps: changedServices.length > 0 || deploymentChanged,
  };
}

function changedFiles(base, head) {
  return execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { encoding: "utf8" })
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

if (process.argv[1]?.endsWith("/changed-services.mjs")) {
  const [base, head, mode] = process.argv.slice(2);
  const forceAll = mode === "--all" || !base || !head || /^0+$/.test(base);
  const files = forceAll ? [] : changedFiles(base, head);
  process.stdout.write(`${JSON.stringify(detectChanges(files, forceAll))}\n`);
}
