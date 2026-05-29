import crypto from "crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Re-uses the same R2 bucket and credentials as receipt storage.
// GST exports are stored under the gst-exports/ prefix.

let s3Client: S3Client | null = null;

type R2Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
};

function getR2Config(): R2Config | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    return null;
  }

  return { bucket, region, accessKeyId, secretAccessKey, endpoint };
}

function getS3Client(): { client: S3Client; config: R2Config } | null {
  const config = getR2Config();
  if (!config) return null;

  if (!s3Client) {
    s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  return { client: s3Client, config };
}

function parseR2StoragePath(
  storagePath: string,
): { bucket: string; key: string } | null {
  if (!storagePath.startsWith("r2://")) return null;
  const withoutScheme = storagePath.slice("r2://".length);
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash <= 0) return null;
  const bucket = decodeURIComponent(withoutScheme.slice(0, firstSlash));
  const key = withoutScheme.slice(firstSlash + 1);
  if (!bucket || !key) return null;
  return { bucket, key };
}

export type StoreGstExportInput = {
  tenantId: string;
  fileBuffer: Buffer;
  filename: string; // e.g. "gst-report-2026-01-01-2026-03-31.csv"
  contentType: string; // "text/csv" | "text/html"
};

export type StoredGstExport = {
  storagePath: string; // r2://bucket/gst-exports/...
  objectKey: string;
};

/**
 * Upload a GST export file to R2.
 * Returns the r2:// storage path to persist in the DB.
 */
export async function storeGstExportFile(
  input: StoreGstExportInput,
): Promise<StoredGstExport> {
  const remote = getS3Client();

  if (!remote) {
    throw new Error(
      "R2 storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_ENDPOINT.",
    );
  }

  const fileId = crypto.randomUUID();
  const ext = input.filename.endsWith(".csv") ? ".csv" : ".html";
  const objectKey = `gst-exports/${input.tenantId}/${fileId}${ext}`;

  await remote.client.send(
    new PutObjectCommand({
      Bucket: remote.config.bucket,
      Key: objectKey,
      Body: input.fileBuffer,
      ContentType: input.contentType,
      ContentDisposition: `attachment; filename="${input.filename}"`,
    }),
  );

  return {
    storagePath: `r2://${encodeURIComponent(remote.config.bucket)}/${objectKey}`,
    objectKey,
  };
}

/**
 * Generate a short-lived signed URL for a stored GST export.
 * Returns null if the path is not an R2 path or storage is not configured.
 */
export async function getGstExportSignedUrl(
  storagePath: string | null,
  expiresInSeconds = Number(
    process.env.RECEIPT_SIGNED_URL_TTL_SECONDS || "900",
  ),
): Promise<string | null> {
  if (!storagePath) return null;

  const remote = parseR2StoragePath(storagePath);
  if (!remote) return null;

  const client = getS3Client();
  if (!client) return null;

  return getSignedUrl(
    client.client,
    new GetObjectCommand({ Bucket: remote.bucket, Key: remote.key }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * Fetch the stored GST export file contents from R2.
 * Returns null when storage is unavailable or the path is invalid.
 */
export async function getGstExportFileContents(
  storagePath: string | null,
): Promise<string | null> {
  if (!storagePath) {
    return null;
  }

  const remote = parseR2StoragePath(storagePath);
  if (!remote) {
    return null;
  }

  const client = getS3Client();
  if (!client) {
    return null;
  }

  try {
    const response = await client.client.send(
      new GetObjectCommand({ Bucket: remote.bucket, Key: remote.key }),
    );

    if (response.Body) {
      return response.Body.transformToString("utf-8");
    }
  } catch {
    // Fall through to signed-URL fetch.
  }

  const signedUrl = await getGstExportSignedUrl(storagePath);
  if (!signedUrl) {
    return null;
  }

  const response = await fetch(signedUrl);
  if (!response.ok) {
    return null;
  }

  return response.text();
}
