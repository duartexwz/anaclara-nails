import uuid
from http import HTTPStatus

from asyncpg import Connection
from fastapi import HTTPException, UploadFile

from api.repositories.modelos_unhas_repository import ModelosUnhasRepository
from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado
from api.settings import settings
from api.storage.r2 import R2Client, get_r2_client

EXTENSOES_PERMITIDAS = {'.jpg', '.jpeg', '.png', '.webp'}
MIME_POR_EXTENSAO = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
}


def _exigir_admin(current_user: UsuarioLogado) -> None:
    if current_user.type_user_id != TypeUserEnum.ADMIN.value:
        raise HTTPException(
            detail='A ação requer elevação',
            status_code=HTTPStatus.FORBIDDEN,
        )


def _exigir_r2() -> R2Client:
    storage = get_r2_client()
    if storage is None:
        raise HTTPException(
            detail='Armazenamento R2 não configurado',
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
        )
    return storage


def _validar_imagem(arquivo: UploadFile) -> tuple[str, str]:
    nome = (arquivo.filename or '').lower()
    extensao = '.' + nome.rsplit('.', 1)[-1] if '.' in nome else ''
    if extensao not in EXTENSOES_PERMITIDAS:
        raise HTTPException(
            detail='Formato inválido. Envie JPG, PNG ou WEBP',
            status_code=HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
        )
    return extensao, MIME_POR_EXTENSAO[extensao]


# Cria a classe dos serviços de upload (regras, validações e etc)
class UploadsServices:
    def __init__(self, storage: R2Client | None = None):
        self.modelos_unhas_repository = ModelosUnhasRepository()
        self._storage = storage

    @property
    def storage(self) -> R2Client:
        return self._storage or _exigir_r2()

    async def upload_foto_modelo(
        self,
        db: Connection,
        modelo_id: int,
        arquivo: UploadFile,
        current_user: UsuarioLogado,
    ) -> dict:
        _exigir_admin(current_user)

        modelo = await self.modelos_unhas_repository.buscar_por_id(
            db, modelo_id
        )
        if not modelo:
            raise HTTPException(
                detail='Modelo de unha não encontrado',
                status_code=HTTPStatus.NOT_FOUND,
            )

        extensao, content_type = _validar_imagem(arquivo)
        conteudo = await arquivo.read()
        limite = settings.R2_MAX_IMAGE_MB * 1024 * 1024
        if len(conteudo) > limite:
            raise HTTPException(
                detail=f'Imagem maior que {settings.R2_MAX_IMAGE_MB}MB',
                status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
            )

        import io

        chave = f'modelos/{modelo_id}/{uuid.uuid4().hex}{extensao}'
        self.storage.upload_fileobj(
            chave, io.BytesIO(conteudo), content_type
        )
        url = self.storage.public_url(chave)

        await self.modelos_unhas_repository.atualizar(
            db, modelo_id, {'imagem_url': url}
        )

        return {
            'key': chave,
            'url': url,
            'content_type': content_type,
            'size_bytes': len(conteudo),
        }

    async def remover_foto_modelo(
        self,
        db: Connection,
        modelo_id: int,
        current_user: UsuarioLogado,
    ) -> dict:
        _exigir_admin(current_user)

        modelo = await self.modelos_unhas_repository.buscar_por_id(
            db, modelo_id
        )
        if not modelo:
            raise HTTPException(
                detail='Modelo de unha não encontrado',
                status_code=HTTPStatus.NOT_FOUND,
            )

        url = (modelo.get('imagem_url') or '').rstrip('/')
        if url:
            from urllib.parse import urlsplit

            base = (settings.R2_PUBLIC_URL or '').rstrip('/')
            chave = (
                url[len(base) + 1:] if base and url.startswith(base)
                else urlsplit(url).path.lstrip('/')
            )
            self.storage.delete_object(chave)

        await self.modelos_unhas_repository.atualizar(
            db, modelo_id, {'imagem_url': None}
        )

        return {'message': 'Foto removida com sucesso.'}
