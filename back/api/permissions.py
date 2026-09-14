from api.schemas.enums import TypeUserEnum
from api.schemas.global_schemas import UsuarioLogado


def is_user_or_master(user: UsuarioLogado) -> bool:
    return user.type_user_id in {
        TypeUserEnum.ADMIN.value,
        TypeUserEnum.USER.value
    }

def is_master(user: UsuarioLogado) -> bool:
    return user.type_user_id == TypeUserEnum.ADMIN.value