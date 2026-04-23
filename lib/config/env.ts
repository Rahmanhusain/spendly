/**
 * Environment configuration validator
 * Ensures all required environment variables are set
 */

const requiredEnvVars = ["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "NODE_ENV"];

const validateEnv = (): void => {
  const missing = requiredEnvVars.filter((env) => !process.env[env]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((env) => console.error(`   - ${env}`));
    console.error(
      "Copy .env.example to .env.local and fill in the missing values before starting the app.",
    );
    process.exit(1);
  }

  console.log("✅ All required environment variables are set");
};

export default validateEnv;
