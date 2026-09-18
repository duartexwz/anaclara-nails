from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / '.env'

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding='utf-8'
    )

    # Aplicação
    ENVIRONMENT: str = 'dev'
    DATABASE_URL: str
    SECRET_KEY: str
    CLIENT_ID: int
    ACCESS_TOKEN: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = 'HS256'
    FRONTEND_URL: str = 'http://localhost:8010'
    CLIENT_SECRET: str = ''

    # Pagamento
    MERCADO_PAGO_ACCESS_TOKEN: str
    MERCADO_PAGO_PUBLIC_KEY: str
    MERCADO_PAGO_WEBHOOK_ACESS_TOKEN: str = ''

    # Email
    SMPT_USER: str = ''
    SMTP_PASSORD: str = ''
    SMTP_HOST: str = 'smtp.gmail.com'
    SMTP_FROM: str = 'noreply@anaclaranails.com'
    SMTP_PORT: int = 587
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = True
    APP_PUBLIC_URL: str = 'http://localhost:8099'


    # Cors
    CORS_ORIGINS: str

    WHATSAPP_ACESS_TOKEN:str
    WHATSAPP_SECRET_KEY: str

    # Cookies de Autenticação
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = 'lax'
    COOKIE_DOMAIN: str | None = None
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cloudflare R2 (armazenamento de imagens — opcional até configurar)
    R2_ACCOUNT_ID: str | None = None
    R2_ACCESS_KEY_ID: str | None = None
    R2_SECRET_ACCESS_KEY: str | None = None
    R2_BUCKET: str | None = None
    R2_PUBLIC_URL: str | None = None
    R2_MAX_IMAGE_MB: int = 5

    # Web Push / VAPID (notificações no dispositivo da admin)
    # Gere com: python -m py_vapid --gen
    VAPID_PUBLIC_KEY: str | None = None
    VAPID_PRIVATE_KEY: str | None = None
    VAPID_SUBJECT: str | None = None


settings = Settings()
