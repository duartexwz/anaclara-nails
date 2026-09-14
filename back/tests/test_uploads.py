from http import HTTPStatus

import pytest
from fastapi import HTTPException, UploadFile

from api.services.uploads_service import UploadsServices
from api.storage import r2 as r2_mod
from tests.conftest import CSRF_COOKIES, CSRF_HEADERS


class FakeStorage:
    def __init__(self):
        self.enviados = {}
        self.removidos = []

    def upload_fileobj(self, key, data, content_type):
        self.enviados[key] = {
            'content_type': content_type,
            'size': len(data.read()),
        }

    def delete_object(self, key):
        self.removidos.append(key)

    def public_url(self, key):
        return f'https://cdn.teste/{key}'


def arquivo(nome='foto.png', conteudo=b'\x89PNG fake'):
    return UploadFile(filename=nome, file=__import__('io').BytesIO(conteudo))


MODELO = {'id': 7, 'nome': 'Chrome'}


class TestUploadFotoModelo:
    async def test_nao_admin_403(self, fake_db, comum_user):
        svc = UploadsServices(storage=FakeStorage())
        with pytest.raises(HTTPException) as exc:
            await svc.upload_foto_modelo(
                fake_db, 7, arquivo(), comum_user
            )
        assert exc.value.status_code == HTTPStatus.FORBIDDEN

    async def test_modelo_inexistente_404(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None)
        svc = UploadsServices(storage=FakeStorage())
        with pytest.raises(HTTPException) as exc:
            await svc.upload_foto_modelo(
                fake_db, 99, arquivo(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.NOT_FOUND

    async def test_formato_invalido_415(self, fake_db, admin_user):
        fake_db.queue_fetchrow(MODELO)
        svc = UploadsServices(storage=FakeStorage())
        with pytest.raises(HTTPException) as exc:
            await svc.upload_foto_modelo(
                fake_db, 7, arquivo('foto.txt', b'texto'), admin_user
            )
        assert exc.value.status_code == HTTPStatus.UNSUPPORTED_MEDIA_TYPE

    async def test_grande_demais_413(self, fake_db, admin_user, monkeypatch):
        fake_db.queue_fetchrow(MODELO)
        monkeypatch.setattr(r2_mod.settings, 'R2_MAX_IMAGE_MB', 0)
        svc = UploadsServices(storage=FakeStorage())
        with pytest.raises(HTTPException) as exc:
            await svc.upload_foto_modelo(
                fake_db, 7, arquivo(), admin_user
            )
        assert exc.value.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE

    async def test_ok_atualiza_imagem_url(self, fake_db, admin_user):
        fake_db.queue_fetchrow(
            MODELO, {'id': 7, 'imagem_url': 'https://cdn.teste/x'}
        )
        storage = FakeStorage()
        svc = UploadsServices(storage=storage)
        resultado = await svc.upload_foto_modelo(
            fake_db, 7, arquivo(), admin_user
        )
        assert resultado['url'].startswith('https://cdn.teste/modelos/7/')
        assert resultado['content_type'] == 'image/png'
        assert resultado['size_bytes'] > 0
        assert len(storage.enviados) == 1

    async def test_r2_nao_configurado_503(self, fake_db, admin_user):
        fake_db.queue_fetchrow(MODELO)
        svc = UploadsServices(storage=None)
        import api.services.uploads_service as svc_mod

        real = svc_mod.get_r2_client
        svc_mod.get_r2_client = lambda: None
        try:
            with pytest.raises(HTTPException) as exc:
                await svc.upload_foto_modelo(
                    fake_db, 7, arquivo(), admin_user
                )
        finally:
            svc_mod.get_r2_client = real
        assert exc.value.status_code == HTTPStatus.SERVICE_UNAVAILABLE


class TestRemoverFotoModelo:
    async def test_ok(self, fake_db, admin_user):
        fake_db.queue_fetchrow(
            {**MODELO, 'imagem_url': 'https://cdn.teste/modelos/7/a.png'},
            {'id': 7},
        )
        storage = FakeStorage()
        svc = UploadsServices(storage=storage)
        resultado = await svc.remover_foto_modelo(
            fake_db, 7, admin_user
        )
        assert resultado['message']
        assert storage.removidos == ['modelos/7/a.png']

    async def test_modelo_inexistente_404(self, fake_db, admin_user):
        fake_db.queue_fetchrow(None)
        svc = UploadsServices(storage=FakeStorage())
        with pytest.raises(HTTPException) as exc:
            await svc.remover_foto_modelo(fake_db, 99, admin_user)
        assert exc.value.status_code == HTTPStatus.NOT_FOUND


class TestRotasUpload:
    async def test_post_201(self, client, fake_db, as_admin, monkeypatch):
        import api.routers.uploads as router_mod

        fake_db.queue_fetchrow(MODELO, {'id': 7})
        monkeypatch.setattr(
            router_mod,
            'uploads_services',
            UploadsServices(storage=FakeStorage()),
        )
        resposta = await client.post(
            '/api/v1/uploads/modelos/7',
            files={'arquivo': ('foto.png', b'\x89PNG', 'image/png')},
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 201
        assert resposta.json()['url'].startswith(
            'https://cdn.teste/modelos/7/'
        )

    async def test_post_401_anonimo(self, client, as_anon, fake_db):
        resposta = await client.post(
            '/api/v1/uploads/modelos/7',
            files={'arquivo': ('foto.png', b'\x89PNG', 'image/png')},
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 401

    async def test_delete_200(self, client, fake_db, as_admin, monkeypatch):
        import api.routers.uploads as router_mod

        fake_db.queue_fetchrow(
            {**MODELO, 'imagem_url': 'https://cdn.teste/x.png'},
            {'id': 7},
        )
        monkeypatch.setattr(
            router_mod,
            'uploads_services',
            UploadsServices(storage=FakeStorage()),
        )
        resposta = await client.delete(
            '/api/v1/uploads/modelos/7',
            headers=CSRF_HEADERS,
            cookies=CSRF_COOKIES,
        )
        assert resposta.status_code == 200


class TestR2Helpers:
    def test_endpoint(self):
        assert r2_mod.r2_endpoint('abc123') == (
            'https://abc123.r2.cloudflarestorage.com'
        )

    def test_nao_configurado_sem_env(self, monkeypatch):
        monkeypatch.setattr(r2_mod.settings, 'R2_ACCOUNT_ID', None)
        assert r2_mod.is_r2_configured() is False
        assert r2_mod.get_r2_client() is None
