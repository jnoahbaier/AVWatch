"""
S3-compatible storage service (Cloudflare R2).
Generates presigned PUT URLs so the browser uploads directly to R2
without routing file bytes through this server.
"""

import boto3
from botocore.config import Config

from app.core.config import settings

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "image/heic", "image/heif",
    "video/mp4", "video/quicktime", "video/webm", "video/x-m4v",
}


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION,
        config=Config(signature_version="s3v4"),
    )


def generate_presigned_upload(key: str, content_type: str, expires_in: int = 300) -> str:
    """Return a presigned PUT URL valid for `expires_in` seconds."""
    return _client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.AWS_S3_BUCKET,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )


def public_url(key: str) -> str:
    return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
