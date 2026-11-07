from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado


def is_user_or_master(user: UsuarioLogado) -> bool:
    return user.type_user_id in {
        TypeUserEnum.ADMIN.value,
        TypeUserEnum.USER.value,
        TypeUserEnum.NAIL_ADMIN.value
    }

def is_master(user: UsuarioLogado) -> bool:
    return user.type_user_id == TypeUserEnum.ADMIN.value

def is_admin_or_nail(user: UsuarioLogado) -> bool:
    """Perfis com acesso ao painel administrativo:
    admin completo (1) e nail admin com acesso limitado (3)."""
    return user.type_user_id in {
        TypeUserEnum.ADMIN.value,
        TypeUserEnum.NAIL_ADMIN.value
    }

def is_nail_admin(user: UsuarioLogado) -> bool:
    return user.type_user_id == TypeUserEnum.NAIL_ADMIN.value

_is_nail = is_nail_admin
