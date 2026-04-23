#!/usr/bin/env node

/**
 * Display daily development summary from progress log
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logsDir = path.join(__dirname, "../logs");
const progressFile = path.join(logsDir, "progress.log");

if (!fs.existsSync(progressFile)) {
  console.log("📋 No progress log available yet.\n");
  process.exit(0);
}

try {
  const content = fs.readFileSync(progressFile, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  // Get today's entries
  const today = new Date().toISOString().split("T")[0];
  const todayEntries = lines.filter((l) => l.includes(today));

  console.log("\n📅 TODAY'S DEVELOPMENT LOG\n");
  console.log(`Date: ${today}\n`);
  console.log("--- Progress ---\n");

  if (todayEntries.length === 0) {
    console.log("No activity logged today.\n");
  } else {
    todayEntries.forEach((entry) => {
      // Pretty print log entry
      const match = entry.match(/\[(.*?)\] \[(.*?)\] (.+)/);
      if (match) {
        const time = match[1].split("T")[1].split(".")[0];
        const level = match[2];
        const message = match[3];
        console.log(`${time} [${level}] ${message}`);
      } else {
        console.log(entry);
      }
    });
  }

  // Show summary stats
  console.log("\n--- Statistics ---\n");
  const features = lines.filter((l) => l.includes("[FEATURE]")).length;
  const errors = lines.filter((l) => l.includes("[ERROR]")).length;
  const milestones = lines.filter((l) => l.includes("[MILESTONE]")).length;

  console.log(`Features Updated: ${features}`);
  console.log(`Errors: ${errors}`);
  console.log(`Milestones: ${milestones}`);
  console.log();
} catch (error) {
  console.error("Error reading progress log:", error);
  process.exit(1);
}
