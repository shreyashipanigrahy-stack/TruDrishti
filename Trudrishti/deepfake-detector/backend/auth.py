import os
import random
import time
import smtplib
from email.mime.text import MIMEText
import jwt
import bcrypt

# Configurations
JWT_SECRET = os.environ.get("JWT_SECRET", "trudrishti-auth-secret-key-12345")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days

SMTP_SERVER = os.environ.get("SMTP_SERVER", os.environ.get("SMTP_HOST", ""))
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", os.environ.get("SMTP_USER", ""))
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "no-reply@trudrishti.ai")

# In-memory OTP cache: { email: { "otp": str, "name": str, "avatar": str, "expires_at": float } }
_otp_cache = {}
OTP_EXPIRY_SECONDS = 10 * 60  # 10 minutes

# Password Hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT tokens
def generate_jwt_token(email: str, name: str) -> str:
    payload = {
        "sub": email,
        "name": name,
        "exp": time.time() + JWT_EXPIRY_SECONDS
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

# OTP management
def generate_otp() -> str:
    return f"{random.randint(100000, 999999)}"

def cache_otp(email: str, otp: str, name: str, avatar: str):
    _otp_cache[email] = {
        "otp": otp,
        "name": name,
        "avatar": avatar,
        "expires_at": time.time() + OTP_EXPIRY_SECONDS
    }

def get_cached_otp_data(email: str) -> dict:
    data = _otp_cache.get(email)
    if data:
        if time.time() > data["expires_at"]:
            _otp_cache.pop(email, None)  # Expired
            return None
        return data
    return None

def clear_cached_otp(email: str):
    _otp_cache.pop(email, None)

def send_otp_email(email: str, otp: str) -> bool:
    """Send OTP email using SMTP; fall back to terminal logging if server not configured."""
    subject = "TruDrishti Security Verification Code"
    body = (
        f"Hello,\n\n"
        f"Your verification code to complete sign-in is: {otp}\n\n"
        f"This code will expire in 10 minutes. Please do not share it with anyone.\n\n"
        f"Best regards,\n"
        f"TruDrishti Security Team"
    )

    print("\n" + "="*60)
    print(f"[SECURITY] OTP for {email} is: {otp}")
    print("="*60 + "\n")

    # If SMTP is not configured, exit successfully with console print fallback
    if not SMTP_SERVER or not SMTP_USERNAME or not SMTP_PASSWORD:
        print("[SMTP] Mail server not configured. Printed OTP to terminal for local testing.")
        return True

    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = email

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [email], msg.as_string())
        print(f"[SMTP] Email successfully sent to {email}.")
        return True
    except Exception as e:
        print(f"[SMTP] Failed to send email via SMTP to {email}: {e}")
        return False
