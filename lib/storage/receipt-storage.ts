import crypto from "crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type R2Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
};

type StoreReceiptFileInput = {
  tenantId: string;
  userId: string;
  fileBuffer: Buffer;
  fileName: string;
  contentType: string;
  extension: string;
};

type StoredReceiptFile = {
  storagePath: string;
};

let s3Client: S3Client | null = null;

function getR2Config(): R2Config | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    return null;
  }

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint,
  };
}

function getS3Client(): { client: S3Client; config: R2Config } | null {
  const config = getR2Config();

  if (!config) {
    return null;
  }

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
  if (!storagePath.startsWith("r2://")) {
    return null;
  }

  const withoutScheme = storagePath.slice("r2://".length);
  const firstSlash = withoutScheme.indexOf("/");

  if (firstSlash <= 0) {
    return null;
  }

  const bucket = decodeURIComponent(withoutScheme.slice(0, firstSlash));
  const key = withoutScheme.slice(firstSlash + 1);

  if (!bucket || !key) {
    return null;
  }

  return { bucket, key };
}

function toPublicReceiptUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");

  if (normalized.startsWith("./public/")) {
    return normalized.slice("./public".length);
  }

  if (normalized.startsWith("public/")) {
    return `/${normalized.slice("public/".length)}`;
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function isR2ReceiptStorageEnabled(): boolean {
  return Boolean(getR2Config());
}

export async function storeReceiptFile(
  input: StoreReceiptFileInput,
): Promise<StoredReceiptFile> {
  const remote = getS3Client();

  if (!remote) {
    throw new Error(
      "Receipt storage is not configured for private bucket uploads",
    );
  }

  const fileId = crypto.randomUUID();
  const objectKey = `receipts/${input.tenantId}/${input.userId}/${fileId}${input.extension}`;

  await remote.client.send(
    new PutObjectCommand({
      Bucket: remote.config.bucket,
      Key: objectKey,
      Body: input.fileBuffer,
      ContentType: input.contentType,
    }),
  );

  return {
    storagePath: `r2://${encodeURIComponent(remote.config.bucket)}/${objectKey}`,
  };
}

export async function getStoredReceiptFileUrl(
  storagePath: string | null,
  expiresInSeconds = Number(
    process.env.RECEIPT_SIGNED_URL_TTL_SECONDS || "900",
  ),
): Promise<string | null> {
  if (!storagePath) {
    return null;
  }

  const remote = parseR2StoragePath(storagePath);
  if (remote) {
    const client = getS3Client();
    if (!client) {
      return null;
    }

    return getSignedUrl(
      client.client,
      new GetObjectCommand({
        Bucket: remote.bucket,
        Key: remote.key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  return null;
}
