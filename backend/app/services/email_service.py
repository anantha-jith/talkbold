"""
email_service.py — OTP email delivery via Gmail SMTP.

Configure by setting SMTP_EMAIL and SMTP_PASS in backend/.env
Use a Gmail App Password (not your main Gmail password):
  https://myaccount.google.com/apppasswords

If not configured, OTP is only printed to the backend console.
"""

import smtplib, os, logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


def send_otp(to_email: str, otp: str) -> bool:
    """
    Send OTP to `to_email` via Gmail SMTP.
    Credentials are read from .env (SMTP_EMAIL, SMTP_PASS).
    Falls back to console-only if not configured.
    """
    # Read fresh each time — picks up .env changes without restart
    smtp_email = os.getenv("SMTP_EMAIL", "").strip()
    smtp_pass  = os.getenv("SMTP_PASS",  "").strip()

    print(f"\n{'='*50}", flush=True)
    print(f"[OTP] Email : {to_email}")
    print(f"[OTP] Code  : {otp}")
    print(f"{'='*50}\n", flush=True)

    if not smtp_email or not smtp_pass or smtp_email == "your_gmail@gmail.com":
        logger.warning("[OTP] SMTP not configured. Edit backend/.env with your Gmail + App Password.")
        return False

    try:
        msg            = MIMEMultipart("alternative")
        msg["Subject"] = "Mock Viva AI — Your Verification Code"
        msg["From"]    = f"Mock Viva AI <{smtp_email}>"
        msg["To"]      = to_email

        html = f"""
        <html>
        <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:40px 20px;">
              <table width="480" cellpadding="0" cellspacing="0"
                     style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;
                            border:1px solid rgba(99,102,241,0.3);overflow:hidden;">
                <tr>
                  <td style="padding:32px 40px;text-align:center;">
                    <div style="font-size:28px;font-weight:800;color:#fff;margin-bottom:4px;">
                      Viva<span style="color:#6366f1;">AI</span>
                    </div>
                    <div style="font-size:13px;color:#94a3b8;margin-bottom:32px;">
                      AI Mock Viva Assessment Platform
                    </div>
                    <div style="font-size:15px;color:#cbd5e1;margin-bottom:24px;">
                      Your email verification code is:
                    </div>
                    <div style="background:rgba(99,102,241,0.15);border:2px solid rgba(99,102,241,0.4);
                                border-radius:12px;padding:20px;margin-bottom:28px;">
                      <span style="font-size:42px;font-weight:900;letter-spacing:14px;color:#a5b4fc;">
                        {otp}
                      </span>
                    </div>
                    <div style="font-size:13px;color:#64748b;">
                      This code expires in <strong style="color:#94a3b8;">10 minutes</strong>.<br>
                      Do not share this code with anyone.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
                    <div style="font-size:11px;color:#475569;">
                      If you didn't sign up for Mock Viva AI, ignore this email.
                    </div>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(smtp_email, smtp_pass)
            server.sendmail(smtp_email, to_email, msg.as_string())

        logger.info(f"[OTP] Email delivered to {to_email}")
        return True

    except Exception as exc:
        logger.error(f"[OTP] Email delivery failed: {exc}")
        return False
