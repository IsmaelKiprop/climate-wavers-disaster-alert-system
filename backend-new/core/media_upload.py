"""Public media upload helpers for admin / API assets."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import uuid
import urllib.error
import urllib.request
from datetime import datetime
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

# Same unsigned preset the frontend uses for posts / group logos.
CLOUDINARY_CLOUD_NAME = getattr(settings, "CLOUDINARY_CLOUD_NAME", "") or os.environ.get(
    "CLOUDINARY_CLOUD_NAME", "lahri"
)
CLOUDINARY_UPLOAD_PRESET = getattr(settings, "CLOUDINARY_UPLOAD_PRESET", "") or os.environ.get(
    "CLOUDINARY_UPLOAD_PRESET", "thyh7ivb"
)


def _force_https(url: str) -> str:
    value = (url or "").strip()
    if value.startswith("http://"):
        return f"https://{value[7:]}"
    return value


def _upload_cloudinary(file_obj, folder: str = "chat/avatars") -> str | None:
    cloud = CLOUDINARY_CLOUD_NAME
    preset = CLOUDINARY_UPLOAD_PRESET
    if not cloud or not preset:
        return None

    name = getattr(file_obj, "name", "") or "upload.jpg"
    content_type = (
        getattr(file_obj, "content_type", None)
        or mimetypes.guess_type(name)[0]
        or "application/octet-stream"
    )
    raw = file_obj.read()
    if hasattr(file_obj, "seek"):
        try:
            file_obj.seek(0)
        except Exception:
            pass
    if not raw:
        return None

    boundary = f"----CwBoundary{uuid.uuid4().hex}"
    body = BytesIO()

    def write_field(field_name, value):
        body.write(f"--{boundary}\r\n".encode())
        body.write(
            f'Content-Disposition: form-data; name="{field_name}"\r\n\r\n'.encode()
        )
        body.write(str(value).encode())
        body.write(b"\r\n")

    write_field("upload_preset", preset)
    write_field("folder", folder)

    body.write(f"--{boundary}\r\n".encode())
    body.write(
        (
            f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(name)}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode()
    )
    body.write(raw)
    body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())
    payload = body.getvalue()

    endpoint = f"https://api.cloudinary.com/v1_1/{cloud}/image/upload"
    request = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(payload)),
            "User-Agent": "ClimateWavers-API/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8", errors="replace") or "{}")
        url = data.get("secure_url") or data.get("url") or ""
        return _force_https(url) or None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.error("Cloudinary upload failed %s: %s", exc.code, detail[:400])
        return None
    except Exception as exc:
        logger.exception("Cloudinary upload error: %s", exc)
        return None


def _upload_storage(file_obj, folder: str = "chat/avatars") -> str | None:
    name = getattr(file_obj, "name", "") or "upload.jpg"
    ext = os.path.splitext(name)[1] or ".jpg"
    path = f"{folder}/{datetime.now().strftime('%Y/%m/%d')}/{uuid.uuid4().hex}{ext.lower()}"
    raw = file_obj.read()
    if hasattr(file_obj, "seek"):
        try:
            file_obj.seek(0)
        except Exception:
            pass
    if not raw:
        return None

    # Prefer public objects when using S3 so chat avatars load in the browser.
    try:
        from storages.backends.s3boto3 import S3Boto3Storage

        if isinstance(default_storage, S3Boto3Storage):
            saved = default_storage.save(
                path,
                ContentFile(raw),
            )
            # Ensure object is publicly readable when bucket policy allows ACL.
            try:
                default_storage.bucket.Object(saved).Acl().put(ACL="public-read")
            except Exception as exc:
                logger.warning("Could not set public-read ACL on %s: %s", saved, exc)
            url = default_storage.url(saved)
            return _force_https(url)
    except Exception:
        pass

    saved = default_storage.save(path, ContentFile(raw))
    url = default_storage.url(saved) if hasattr(default_storage, "url") else f"/media/{saved}"
    if url.startswith("/"):
        host = (
            getattr(settings, "BACKEND_HOST", None)
            or getattr(settings, "BASE_URL", "")
            or ""
        ).rstrip("/")
        if host:
            url = f"{host}{url}"
    return _force_https(url)


def upload_public_image(file_obj, folder: str = "chat/avatars") -> str:
    """
    Upload an image and return a browser-loadable https URL.
    Prefers Cloudinary (same as frontend group logos), then storage.
    """
    if not file_obj:
        raise ValueError("No file provided")

    url = _upload_cloudinary(file_obj, folder=folder)
    if url:
        return url[:500]

    url = _upload_storage(file_obj, folder=folder)
    if url:
        return url[:500]

    raise RuntimeError("Image upload failed")
