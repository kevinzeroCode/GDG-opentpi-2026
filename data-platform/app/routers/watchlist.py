from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.schemas import WatchlistItem, WatchlistResponse
from app.services import db_service
from app.services import auth_service
from jose import JWTError
from typing import Optional

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])
security = HTTPBearer(auto_error=False)


async def optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    if not credentials:
        return None
    try:
        payload = auth_service.decode_token(credentials.credentials)
        user_id = int(payload["sub"])
        return await db_service.get_user_by_id(user_id)
    except (JWTError, KeyError, ValueError):
        return None


@router.get("", response_model=WatchlistResponse)
async def get_watchlist(user: Optional[dict] = Depends(optional_user)):
    if user:
        items = await db_service.get_watchlist_for_user(user["id"])
    else:
        items = await db_service.get_watchlist()
    return WatchlistResponse(items=[WatchlistItem(**i) for i in items])


@router.post("")
async def add_watchlist(item: WatchlistItem, user: Optional[dict] = Depends(optional_user)):
    if user:
        await db_service.add_to_watchlist_for_user(user["id"], item.ticker, item.name)
    else:
        await db_service.add_to_watchlist(item.ticker, item.name)
    return {"ok": True}


@router.delete("/{ticker}")
async def remove_watchlist(ticker: str, user: Optional[dict] = Depends(optional_user)):
    if user:
        await db_service.remove_from_watchlist_for_user(user["id"], ticker)
    else:
        await db_service.remove_from_watchlist(ticker)
    return {"ok": True}
