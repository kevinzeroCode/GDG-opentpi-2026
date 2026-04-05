import logging
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "username": username, "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


async def get_digirunner_token() -> str | None:
    """Server-side: fetch DigiRunner gateway token using service account."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.digirunner_service_url}/dgrv4/tptoken/oauth/token",
                files={
                    "grant_type": (None, "password"),
                    "username": (None, settings.digirunner_username),
                    "password": (None, settings.digirunner_password),
                },
            )
            if resp.status_code == 200:
                return resp.json().get("access_token")
    except Exception:
        logger.exception("Failed to fetch DigiRunner token")
        return None
    return None
