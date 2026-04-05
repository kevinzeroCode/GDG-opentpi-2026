import re
import httpx
from app.config import settings
from app.services.commentary_service import generate_commentary


async def analyze(query: str) -> dict:
    """
    直接呼叫 Dify API（透過 docker_default 網路內的 nginx）。
    自動補足缺失的 commentary / ticker_code 欄位。
    """
    url = f"{settings.dify_internal_url}/workflows/run"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.dify_api_key}",
    }
    payload = {
        "inputs": {"query": query},
        "response_mode": "blocking",
        "user": "quant-platform",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    outputs = data.get("data", {}).get("outputs", {})
    raw_text = outputs.get("ticker") or None
    commentary = outputs.get("commentary") or None
    ticker_code = outputs.get("ticker_code") or None

    # 補足 ticker_code：從 query 中提取 4~6 位數字
    if not ticker_code:
        match = re.search(r"\d{4,6}[A-Za-z]*", query)
        if match:
            ticker_code = match.group()

    # 補足 commentary：Dify 未回傳時，根據指標數值自動生成
    if raw_text and not commentary:
        commentary = generate_commentary(raw_text, ticker_code)

    return {
        "ticker": raw_text,
        "ticker_code": ticker_code,
        "commentary": commentary,
        "raw_text": raw_text,
        "conversation_id": None,
    }


async def chat(query: str, conversation_id: str | None = None) -> dict:
    """
    使用 Dify Chat API（保持對話上下文）。
    需要在 Dify UI 建立 Chat 應用並設定 DIFY_CHAT_API_KEY。
    """
    base = settings.dify_internal_url.removesuffix("/v1").removesuffix("/")
    url = f"{base}/v1/chat-messages"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.dify_chat_api_key or settings.dify_api_key}",
    }
    payload = {
        "inputs": {},
        "query": query,
        "response_mode": "blocking",
        "user": "quant-platform",
    }
    if conversation_id:
        payload["conversation_id"] = conversation_id

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    answer = data.get("answer", "")
    new_conversation_id = data.get("conversation_id")

    # Parse the answer text same way as workflow
    ticker_code = None
    match = re.search(r"\d{4,6}[A-Za-z]*", query)
    if match:
        ticker_code = match.group()

    commentary = answer if answer else generate_commentary(ticker_code)

    return {
        "ticker": answer,
        "ticker_code": ticker_code,
        "commentary": commentary,
        "raw_text": answer,
        "conversation_id": new_conversation_id,
    }
