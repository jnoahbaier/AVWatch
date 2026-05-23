"""
Media upload endpoints.

POST /api/media/presign
  Accepts a filename + content_type, returns a short-lived S3 presigned PUT
  URL plus the final public URL. The browser uploads directly to R2 — file
  bytes never pass through this server.
"""

import uuid
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.services.s3 import ALLOWED_TYPES, generate_presigned_upload, public_url

router = APIRouter()

_SAFE_FILENAME = re.compile(r"[^a-zA-Z0-9._-]")


class PresignRequest(BaseModel):
    filename: str
    content_type: str


class PresignResponse(BaseModel):
    upload_url: str
    public_url: str
    key: str


@router.post("/presign", response_model=PresignResponse)
def presign_upload(body: PresignRequest):
    if not settings.AWS_ACCESS_KEY_ID or not settings.R2_PUBLIC_URL:
        raise HTTPException(status_code=503, detail="Media storage is not configured.")

    if body.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {body.content_type}")

    safe_name = _SAFE_FILENAME.sub("_", body.filename)[:100]
    key = f"{uuid.uuid4().hex}_{safe_name}"

    upload_url = generate_presigned_upload(key, body.content_type)
    return PresignResponse(
        upload_url=upload_url,
        public_url=public_url(key),
        key=key,
    )
