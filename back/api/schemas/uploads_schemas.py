from pydantic import BaseModel


class UploadResponse(BaseModel):
    key: str
    url: str
    content_type: str
    size_bytes: int
