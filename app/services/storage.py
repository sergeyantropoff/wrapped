from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from aiobotocore.session import get_session

from app.config import get_settings


class ObjectStorage:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _client_kwargs(self) -> dict[str, Any]:
        return {
            "endpoint_url": self.settings.s3_endpoint_url,
            "aws_access_key_id": self.settings.s3_access_key,
            "aws_secret_access_key": self.settings.s3_secret_key,
            "region_name": self.settings.s3_region,
            "use_ssl": self.settings.s3_use_ssl,
        }

    @asynccontextmanager
    async def client(self) -> AsyncIterator[Any]:
        session = get_session()
        async with session.create_client("s3", **self._client_kwargs()) as client:
            yield client

    async def ensure_bucket(self) -> None:
        if not self.settings.s3_create_bucket:
            return
        async with self.client() as client:
            try:
                await client.head_bucket(Bucket=self.settings.s3_bucket)
            except Exception:
                await client.create_bucket(Bucket=self.settings.s3_bucket)

    async def put_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        async with self.client() as client:
            await client.put_object(
                Bucket=self.settings.s3_bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )

    async def get_bytes(self, key: str) -> bytes:
        async with self.client() as client:
            resp = await client.get_object(Bucket=self.settings.s3_bucket, Key=key)
            async with resp["Body"] as stream:
                return await stream.read()

    async def delete(self, key: str) -> None:
        async with self.client() as client:
            await client.delete_object(Bucket=self.settings.s3_bucket, Key=key)

    async def delete_prefix(self, prefix: str = "wraps/") -> int:
        """Delete all objects under prefix. Returns number of deleted keys."""
        deleted = 0
        async with self.client() as client:
            token: str | None = None
            while True:
                kwargs: dict[str, Any] = {
                    "Bucket": self.settings.s3_bucket,
                    "Prefix": prefix,
                    "MaxKeys": 1000,
                }
                if token:
                    kwargs["ContinuationToken"] = token
                resp = await client.list_objects_v2(**kwargs)
                contents = resp.get("Contents") or []
                if contents:
                    # delete_objects accepts up to 1000 keys
                    await client.delete_objects(
                        Bucket=self.settings.s3_bucket,
                        Delete={
                            "Objects": [{"Key": obj["Key"]} for obj in contents],
                            "Quiet": True,
                        },
                    )
                    deleted += len(contents)
                if not resp.get("IsTruncated"):
                    break
                token = resp.get("NextContinuationToken")
        return deleted


storage = ObjectStorage()
