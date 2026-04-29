/**
 * Spendly Project Logger
 *
 * Tracks development progress, feature completions, and errors.
 * Logs are written to ./logs/ directory for project visibility.
 *
 * Usage:
 *   import logger from '@/lib/utils/logger';
 *   logger.info('Receipt processing started', { receiptId: '123' });
 *   logger.error('OCR failed', { error: err.message, receiptId: '123' });
 *   logger.feature('COMPLETED', 'User Authentication', { time: '2h 45m' });
 */

import fs from "fs";
import path from "path";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

enum LogLevel {
  INFO = "INFO",
  ERROR = "ERROR",
  WARN = "WARN",
  DEBUG = "DEBUG",
  FEATURE = "FEATURE",
  MILESTONE = "MILESTONE",
}

type LogContext = Record<string, unknown>;

type FeatureTracking = {
  last_updated: string;
  features: Record<string, unknown>;
};

/**
 * Logger service: writes to files and console
 */
class Logger {
  private logFile: string;
  private deviceLogFile: string;
  private errorLogFile: string;

  constructor() {
    this.logFile = path.join(logsDir, "progress.log");
    this.deviceLogFile = path.join(logsDir, "development.log");
    this.errorLogFile = path.join(logsDir, "errors.log");

    // Initialize log files if they don't exist
    if (!fs.existsSync(this.logFile)) {
      this.writeFile(
        this.logFile,
        `=== SPENDLY DEVELOPMENT LOG ===\nStarted: ${new Date().toISOString()}\n\n`,
      );
    }
    if (!fs.existsSync(this.deviceLogFile)) {
      this.writeFile(
        this.deviceLogFile,
        `=== SPENDLY DEVELOPMENT LOG (DETAILED) ===\nStarted: ${new Date().toISOString()}\n\n`,
      );
    }
    if (!fs.existsSync(this.errorLogFile)) {
      this.writeFile(
        this.errorLogFile,
        `=== SPENDLY ERROR LOG ===\nStarted: ${new Date().toISOString()}\n\n`,
      );
    }
  }

  /**
   * Private method: write to file
   */
  private writeFile(
    filePath: string,
    content: string,
    append: boolean = true,
  ): void {
    try {
      if (append) {
        fs.appendFileSync(filePath, content);
      } else {
        fs.writeFileSync(filePath, content);
      }
    } catch (error) {
      console.error(`Failed to write to ${filePath}:`, error);
    }
  }

  /**
   * Private method: format log entry
   */
  private formatLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level}] ${message}${contextStr}\n`;
  }

  /**
   * Log info level
   */
  public info(message: string, context?: LogContext): void {
    const entry = this.formatLogEntry(LogLevel.INFO, message, context);
    console.log(`ℹ️  ${message}`, context || "");
    this.writeFile(this.logFile, entry);
    this.writeFile(this.deviceLogFile, entry);
  }

  /**
   * Log error level
   */
  public error(message: string, context?: LogContext): void {
    const entry = this.formatLogEntry(LogLevel.ERROR, message, context);
    console.error(`❌ ${message}`, context || "");
    this.writeFile(this.logFile, entry);
    this.writeFile(this.deviceLogFile, entry);
    this.writeFile(this.errorLogFile, entry);
  }

  /**
   * Log warning level
   */
  public warn(message: string, context?: LogContext): void {
    const entry = this.formatLogEntry(LogLevel.WARN, message, context);
    console.warn(`⚠️  ${message}`, context || "");
    this.writeFile(this.logFile, entry);
    this.writeFile(this.deviceLogFile, entry);
  }

  /**
   * Log debug level (only in development)
   */
  public debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== "production") {
      const entry = this.formatLogEntry(LogLevel.DEBUG, message, context);
      console.debug(`🐛 ${message}`, context || "");
      this.writeFile(this.deviceLogFile, entry);
    }
  }

  /**
   * Log feature completion/progress
   * Format: [TIMESTAMP] [FEATURE] STATUS: Feature Name (TIME_SPENT)
   */
  public feature(
    status: "STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED",
    featureName: string,
    metadata?: { time?: string; reason?: string; blocker?: string },
  ): void {
    const timeStr = metadata?.time ? ` (${metadata.time})` : "";
    const reasonStr = metadata?.reason ? ` | Reason: ${metadata.reason}` : "";
    const blockerStr = metadata?.blocker
      ? ` | Blocker: ${metadata.blocker}`
      : "";
    const message = `${status}: ${featureName}${timeStr}${reasonStr}${blockerStr}`;
    const entry = this.formatLogEntry(LogLevel.FEATURE, message);

    console.log(`🎯 ${message}`);
    this.writeFile(this.logFile, entry);
    this.writeFile(this.deviceLogFile, entry);

    // Track in JSON format for programmatic access
    this.updateFeatureTracking(featureName, status, metadata);
  }

  /**
   * Log milestone
   */
  public milestone(title: string, description?: string): void {
    const desc = description ? ` | ${description}` : "";
    const message = `MILESTONE: ${title}${desc}`;
    const entry = this.formatLogEntry(LogLevel.MILESTONE, message);

    console.log(`🏁 ${message}`);
    this.writeFile(this.logFile, `\n${entry}`);
    this.writeFile(this.deviceLogFile, `\n${entry}`);
  }

  /**
   * Update feature tracking JSON
   */
  private updateFeatureTracking(
    featureName: string,
    status: string,
    metadata?: Record<string, unknown>,
  ): void {
    const trackingFile = path.join(logsDir, "feature-completion.json");
    let tracking: FeatureTracking = {
      last_updated: new Date().toISOString(),
      features: {},
    };

    if (fs.existsSync(trackingFile)) {
      try {
        const parsed = JSON.parse(
          fs.readFileSync(trackingFile, "utf-8"),
        ) as Partial<FeatureTracking>;
        tracking = {
          last_updated: parsed.last_updated ?? new Date().toISOString(),
          features: parsed.features ?? {},
        };
      } catch (error) {
        console.warn("Could not parse existing feature tracking file");
      }
    }

    tracking.features[featureName] = {
      status,
      last_updated: new Date().toISOString(),
      ...(metadata ?? {}),
    };

    tracking.last_updated = new Date().toISOString();

    try {
      this.writeFile(trackingFile, JSON.stringify(tracking, null, 2), false);
    } catch (error) {
      console.error("Failed to update feature tracking:", error);
    }
  }

  /**
   * Log API request (for development)
   */
  public apiRequest(
    method: string,
    path: string,
    statusCode: number,
    ms: number,
  ): void {
    const entry = this.formatLogEntry(
      LogLevel.DEBUG,
      `${method} ${path} → ${statusCode}`,
      { duration_ms: ms },
    );
    this.writeFile(this.deviceLogFile, entry);
  }

  /**
   * Log database operation
   */
  public dbOperation(
    operation: string,
    table: string,
    rowsAffected: number,
    ms: number,
  ): void {
    const entry = this.formatLogEntry(
      LogLevel.DEBUG,
      `DB: ${operation} on ${table}`,
      { rows_affected: rowsAffected, duration_ms: ms },
    );
    this.writeFile(this.deviceLogFile, entry);
  }

  /**
   * Get progress summary
   */
  public getSummary(): string {
    try {
      const content = fs.readFileSync(this.logFile, "utf-8");
      return content;
    } catch (error) {
      return "No progress log available";
    }
  }

  /**
   * Get feature tracking status
   */
  public getFeatureStatus(): FeatureTracking | { error: string } {
    const trackingFile = path.join(logsDir, "feature-completion.json");
    if (fs.existsSync(trackingFile)) {
      try {
        return JSON.parse(fs.readFileSync(trackingFile, "utf-8")) as FeatureTracking;
      } catch (error) {
        return { error: "Could not parse feature tracking" };
      }
    }
    return {
      last_updated: new Date().toISOString(),
      features: {},
    };
  }

  /**
   * Clear logs (useful for fresh start)
   */
  public clearLogs(): void {
    this.writeFile(
      this.logFile,
      `=== SPENDLY DEVELOPMENT LOG (CLEARED) ===\nStarted: ${new Date().toISOString()}\n\n`,
      false,
    );
    console.log("✅ Development logs cleared");
  }
}

// Export singleton instance
const logger = new Logger();
export default logger;
