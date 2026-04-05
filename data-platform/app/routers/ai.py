import logging
import re
from fastapi import APIRouter, HTTPException
from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.services import dify_service
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

_TICKER_RE = re.compile(r'\d{4,6}[A-Za-z]*')


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest):
    try:
        has_ticker = bool(_TICKER_RE.search(body.query))

        if has_ticker:
            # 有股票代號 → Workflow（回傳結構化指標資料，供前端圖表使用）
            result = await dify_service.analyze(body.query)
            result["conversation_id"] = body.conversation_id
        elif settings.dify_chat_api_key:
            # 一般問答 → Chat（多輪對話，回傳自然語言）
            result = await dify_service.chat(body.query, body.conversation_id)
        else:
            result = await dify_service.analyze(body.query)
            result["conversation_id"] = body.conversation_id
    except Exception as e:
        logger.exception("AI service error")
        raise HTTPException(status_code=502, detail="AI 服務暫時無法使用，請稍後再試")
    return AnalyzeResponse(**result)
