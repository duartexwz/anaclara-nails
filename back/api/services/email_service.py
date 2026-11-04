import asyncio
import logging
from api.settings import settings

logger = logging.getLogger(__name__)


def smtp_configurado() -> bool:
    return bool(settings. SMTP_USER and settings.SMTP_PASSORD)


async def enviar_email_recuperacao(destinatario: str, link: str) -> bool:
    """Envia e-mail de redefinição de senha com link seguro (best-effort)."""
    if not smtp_configurado():
        logger.warning('SMTP não configurado — link de recuperação não enviado')
        return False
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        def _enviar():
            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'Redefinição de senha — Ana Clara Nails'
            msg['From'] = settings.SMTP_FROM or settings. SMTP_USER
            msg['To'] = destinatario

            texto_simples = (
                f'Olá!\n\nRecebemos um pedido para redefinir sua senha na Ana Clara Nails.\n'
                f'Use o link abaixo para criar uma nova senha (válido por 30 minutos):\n\n'
                f'{link}\n\n'
                f'Se você não solicitou a redefinição de senha, ignore esta mensagem.'
            )
            html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #fcf8f9; padding: 20px; color: #333;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #f2e2e6;">
    <h2 style="color: #c95175; margin-top: 0;">Ana Clara Nails</h2>
    <p>Olá!</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
    <p style="margin: 28px 0; text-align: center;">
      <a href="{link}" style="background-color: #c95175; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold; display: inline-block;">Redefinir minha senha</a>
    </p>
    <p style="font-size: 13px; color: #666;">Se o botão não funcionar, copie e cole o link no seu navegador:<br><a href="{link}" style="color: #c95175;">{link}</a></p>
    <hr style="border: none; border-top: 1px solid #f2e2e6; margin: 24px 0;" />
    <p style="font-size: 12px; color: #999; margin-bottom: 0;">Este link é válido por 30 minutos. Se você não pediu a redefinição, fique tranquila: sua conta continua segura.</p>
  </div>
</body>
</html>"""
            msg.attach(MIMEText(texto_simples, 'plain', 'utf-8'))
            msg.attach(MIMEText(html, 'html', 'utf-8'))

            if settings.SMTP_USE_SSL:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
                if settings.SMTP_USE_TLS:
                    server.starttls()
            if settings. SMTP_USER and settings.SMTP_PASSORD:
                server.login(settings. SMTP_USER, settings.SMTP_PASSORD)
            server.send_message(msg)
            server.quit()

        await asyncio.to_thread(_enviar)
        logger.info('E-mail de recuperação enviado para %s', destinatario)
        return True
    except Exception as exc:
        logger.warning('Falha ao enviar e-mail de recuperação: %s', exc)
        return False
