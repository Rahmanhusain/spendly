import fs from "fs";
import path from "path";

const logsDir = process.env.VERCEL
  ? path.join("/tmp", "spendly-admin-logs")
  : path.join(process.cwd(), "logs");

function ensureLogsDirExists(): boolean {
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

enum LogLevel {
  INFO = "INFO",
  ERROR = "ERROR",
  WARN = "WARN",
  DEBUG = "DEBUG",
}

type LogContext = Record<string, unknown>;

class Logger {
  private fileLoggingEnabled: boolean;
  private logFile: string;

  constructor() {
    this.fileLoggingEnabled = ensureLogsDirExists();
    this.logFile = path.join(logsDir, "admin.log");
  }

  private writeFile(filePath: string, content: string): void {
    if (!this.fileLoggingEnabled) {
      return;
    }

    try {
      fs.appendFileSync(filePath, content);
    } catch (error) {
      console.error(`Failed to write to ${filePath}:`, error);
    }
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level}] ${message}${contextStr}\n`;
  }

  info(message: string, context?: LogContext): void {
    const entry = this.formatLogEntry(LogLevel.INFO, message, context);
    console.log(message, context || "");
    this.writeFile(this.logFile, entry);
  }

  error(message: string, context?: LogContext): void {
    const entry = this.formatLogEntry(LogLevel.ERROR, message, context);
    console.error(message, context || "");
    this.writeFile(this.logFile, entry);
  }

  warn(message: string, context?: LogContext): void {
    const entry = this.formatLogEntry(LogLevel.WARN, message, context);
    console.warn(message, context || "");
    this.writeFile(this.logFile, entry);
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== "production") {
      const entry = this.formatLogEntry(LogLevel.DEBUG, message, context);
      console.debug(message, context || "");
      this.writeFile(this.logFile, entry);
    }
  }
}

const logger = new Logger();

export default logger;
