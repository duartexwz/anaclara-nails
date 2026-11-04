from pydantic import BaseModel

class EmailSchema(BaseModel):
    assunto: str
    corpo_html: str

class EmailResponseSchema(BaseModel):
    sucesso: bool
    mensagem: str