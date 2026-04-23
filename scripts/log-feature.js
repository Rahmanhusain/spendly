#!/usr/bin/env node

/**
 * Script to log feature completion/progress
 * Usage:
 *   node scripts/log-feature.js "Feature Name" "COMPLETED" "2h 30m"
 *   node scripts/log-feature.js "API Setup" "IN_PROGRESS"
 *   node scripts/log-feature.js "OAuth" "BLOCKED" "waiting-for-client-credentials"
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(
    'Usage: node scripts/log-feature.js "Feature Name" "STATUS" [metadata]',
  );
  console.error("Status: STARTED | IN_PROGRESS | COMPLETED | BLOCKED");
  process.exit(1);
}

const featureName = args[0];
const status = args[1].toUpperCase();
const metadata = args[2] || null;

// Validate status
const validStatuses = ["STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"];
if (!validStatuses.includes(status)) {
  console.error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  process.exit(1);
}

// Read or create tracking file
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const trackingFile = path.join(logsDir, "feature-completion.json");
let tracking = {
  last_updated: new Date().toISOString(),
  features: {},
};

if (fs.existsSync(trackingFile)) {
  try {
    tracking = JSON.parse(fs.readFileSync(trackingFile, "utf-8"));
  } catch (error) {
    console.warn(
      "Warning: Could not parse existing tracking file, starting fresh",
    );
  }
}

// Update feature
tracking.features[featureName] = {
  status,
  last_updated: new Date().toISOString(),
  metadata,
};
tracking.last_updated = new Date().toISOString();

// Write tracking file
fs.writeFileSync(trackingFile, JSON.stringify(tracking, null, 2));

// Log to progress.log
const progressFile = path.join(logsDir, "progress.log");
const timestamp = new Date().toISOString();
const logEntry = `[${timestamp}] [FEATURE] ${status}: ${featureName}${metadata ? ` (${metadata})` : ""}\n`;

fs.appendFileSync(progressFile, logEntry);

console.log(
  `✅ Logged: ${status} - ${featureName}${metadata ? ` (${metadata})` : ""}`,
);
