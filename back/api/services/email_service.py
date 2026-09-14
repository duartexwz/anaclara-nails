import asyncio
import logging
import smtplib
from email.message import EmailMessage

from api.settings import settings

log = logging.getLogger('email')


def smtp_configurado() -> bool:
    return bool(
        settings.SMPT_USER
        and settings.SMTP_PASSORD
        and settings.SMTP_HOST
        and settings.SMTP_FROM
    )


def _enviar_smtp(destinatario: str, assunto: str, corpo: str) -> None:
    msg = EmailMessage()
    msg['From'] = settings.SMTP_FROM
    msg['To'] = destinatario
    msg['Subject'] = assunto
    msg.set_content(corpo)

    porta = int(settings.SMTP_PORT or 587)
    if settings.SMTP_USE_SSL:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, porta) as smtp:
            smtp.login(settings.SMPT_USER, settings.SMTP_PASSORD)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, porta) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMPT_USER:
                smtp.login(settings.SMPT_USER, settings.SMTP_PASSORD)
            smtp.send_message(msg)


async def enviar_email_recuperacao(
    destinatario: str, link: str
) -> bool:
    ## BEST-EFFORT: FALHA DE SMTP NUNCA QUEBRA O FLUXO (LOGADO)
    if not smtp_configurado():
        log.warning('SMTP não configurado — link de recuperação não enviado')
        return False
    try:
        await asyncio.to_thread(
            _enviar_smtp,
            destinatario,
            'Redefinição de senha — Ana Clara Nails',
            f'Olá! Use o link abaixo para criar uma nova senha (vale por 30 minutos):\n\n{link}\n\nSe não foi você, ignore esta mensagem.',
        )
        return True
    except Exception as exc:
        log.warning('Falha ao enviar e-mail de recuperação: %s', exc)
        return False
