from pydantic import BaseModel
from enum import Enum, IntEnum


class Operador(str, Enum):
    IGUAL = '='
    ILIKE = 'ILIKE'
    MAIOR = '>'
    MENOR = '<'
    MAIOR_IGUAL = '>='
    MENOR_IGUAL = '<='

class StatusPagamentoEnum(str, Enum):
    PENDENTE = "Pendente"
    PAGO = "Pago"
    CANCELADO = "Cancelado"

class TypeUserEnum(int, Enum):
    ADMIN = 1
    USER = 2