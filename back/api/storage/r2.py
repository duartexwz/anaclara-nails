"""Cliente S3-compatível para o Cloudflare R2.

O R2 expõe endpoint S3 em:
    https://<ACCOUNT_ID>.r2.cloudflarestorage.com

Basta preencher as variáveis R2_* no .env para ativar. Com elas
ausentes, `get_r2_client()` retorna None e os uploads respondem 503
(service unavailable) em vez de quebrar o boot da API.
"""

from __future__ import annotations

from typing import BinaryIO

from api.settings import settings


def r2_endpoint(account_id: str) -> str:
    return f'https://{account_id}.r2.cloudflarestorage.com'


def is_r2_configured() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET
    )


class R2Client:
    """Wrapper fino sobre boto3 para o bucket do projeto."""

    def __init__(self, client=None):
        # client injetável para testes (evita credencial real)
        if client is not None:
            self._client = client
            return
        import boto3

        self._client = boto3.client(
            's3',
            endpoint_url=r2_endpoint(settings.R2_ACCOUNT_ID or ''),
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name='auto',
        )

    @property
    def bucket(self) -> str:
        return settings.R2_BUCKET or ''

    def upload_fileobj(
        self, key: str, data: BinaryIO, content_type: str
    ) -> None:
        self._client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    def delete_object(self, key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=key)

    def public_url(self, key: str) -> str:
        base = (settings.R2_PUBLIC_URL or '').rstrip('/')
        if base:
            return f'{base}/{key}'
        return (
            f'{r2_endpoint(settings.R2_ACCOUNT_ID or "")}/'
            f'{self.bucket}/{key}'
        )


def get_r2_client() -> R2Client | None:
    if not is_r2_configured():
        return None
    return R2Client()
