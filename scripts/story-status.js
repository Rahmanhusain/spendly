#!/usr/bin/env node

/**
 * Display current story/feature status
 * Shows all completed, in-progress, and not-started features
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logsDir = path.join(__dirname, "../logs");
const trackingFile = path.join(logsDir, "feature-completion.json");

if (!fs.existsSync(trackingFile)) {
  console.log(
    "📋 No stories tracked yet. Start by running npm run log:feature\n",
  );
  process.exit(0);
}

try {
  const tracking = JSON.parse(fs.readFileSync(trackingFile, "utf-8"));
  const features = tracking.features || {};

  const completed = Object.entries(features)
    .filter(([_, f]) => f.status === "COMPLETED")
    .map(([name]) => name);

  const inProgress = Object.entries(features)
    .filter(([_, f]) => f.status === "IN_PROGRESS")
    .map(([name]) => name);

  const notStarted = Object.entries(features)
    .filter(([_, f]) => f.status === "STARTED")
    .map(([name]) => name);

  const blocked = Object.entries(features)
    .filter(([_, f]) => f.status === "BLOCKED")
    .map(([name, f]) => `${name} (${f.metadata || "unknown"})`);

  console.log("\n📊 SPENDLY STORY STATUS\n");
  console.log(`Last Updated: ${tracking.last_updated}\n`);

  if (completed.length > 0) {
    console.log(`✅ COMPLETED (${completed.length})`);
    completed.forEach((name) => console.log(`   • ${name}`));
    console.log();
  }

  if (inProgress.length > 0) {
    console.log(`🔄 IN PROGRESS (${inProgress.length})`);
    inProgress.forEach((name) => console.log(`   • ${name}`));
    console.log();
  }

  if (notStarted.length > 0) {
    console.log(`⭐ STARTED (${notStarted.length})`);
    notStarted.forEach((name) => console.log(`   • ${name}`));
    console.log();
  }

  if (blocked.length > 0) {
    console.log(`🛑 BLOCKED (${blocked.length})`);
    blocked.forEach((item) => console.log(`   • ${item}`));
    console.log();
  }

  const total = Object.keys(features).length;
  console.log(`\n📈 Overall Progress: ${completed.length}/${total} completed`);
  if (total > 0) {
    const percentage = Math.round((completed.length / total) * 100);
    console.log(`   ${percentage}% complete\n`);
  }
} catch (error) {
  console.error("Error reading feature tracking:", error);
  process.exit(1);
}
