from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.services import auth_service
from app.services.db_service import create_user, get_user_by_username, get_user_by_id
from jose import JWTError

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    dgr_token: str | None = None
    user_id: int
    username: str
    email: str


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="未登入")
    try:
        payload = auth_service.decode_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token 無效或已過期")
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用戶不存在")
    return user


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    if len(body.username) < 2:
        raise HTTPException(status_code=400, detail="帳號至少 2 個字元")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="密碼至少 6 個字元")
    existing = await get_user_by_username(body.username)
    if existing:
        raise HTTPException(status_code=409, detail="帳號已存在")
    hashed = auth_service.hash_password(body.password)
    user = await create_user(body.username, body.email, hashed)
    token = auth_service.create_access_token(user["id"], user["username"])
    dgr_token = await auth_service.get_digirunner_token()
    return AuthResponse(
        access_token=token,
        dgr_token=dgr_token,
        user_id=user["id"],
        username=user["username"],
        email=user["email"],
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    user = await get_user_by_username(body.username)
    if not user or not auth_service.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    token = auth_service.create_access_token(user["id"], user["username"])
    dgr_token = await auth_service.get_digirunner_token()
    return AuthResponse(
        access_token=token,
        dgr_token=dgr_token,
        user_id=user["id"],
        username=user["username"],
        email=user["email"],
    )


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user
