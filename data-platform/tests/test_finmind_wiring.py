from unittest.mock import AsyncMock, MagicMock, patch


def _ok_response(data=None):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"status": 200, "data": data or []}
    resp.raise_for_status = MagicMock()
    return resp


async def test_etl_fetch_finmind_delegates_to_client():
    from app.services import etl_service

    with (
        patch("app.services.finmind_client.fetch", new_callable=AsyncMock, return_value=[]) as fetch,
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=_ok_response())
        await etl_service._fetch_finmind("2330", "2026-01-01")

    fetch.assert_awaited_once_with("TaiwanStockPrice", "2330", "2026-01-01")


async def test_chips_fetch_finmind_delegates_to_client():
    from app.services import chips_service

    with (
        patch("app.services.finmind_client.fetch", new_callable=AsyncMock, return_value=[]) as fetch,
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=_ok_response())
        await chips_service._fetch_finmind("TaiwanStockMarginPurchaseShortSale", "2330", "2026-01-01")

    fetch.assert_awaited_once_with("TaiwanStockMarginPurchaseShortSale", "2330", "2026-01-01")


async def test_financial_fetch_finmind_delegates_to_client():
    from app.services import financial_service

    with (
        patch("app.services.finmind_client.fetch", new_callable=AsyncMock, return_value=[]) as fetch,
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=_ok_response())
        await financial_service._fetch_finmind("TaiwanStockMonthRevenue", "2330", "2026-01-01")

    fetch.assert_awaited_once_with("TaiwanStockMonthRevenue", "2330", "2026-01-01")


async def test_twse_fetch_candles_delegates_to_client_and_preserves_envelope():
    from app.services import twse_service

    rows = [{"stock_id": "2330"}]
    with (
        patch("app.services.finmind_client.fetch", new_callable=AsyncMock, return_value=rows) as fetch,
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=_ok_response(rows))
        result = await twse_service.fetch_candles("2330", "2026-01-01")

    fetch.assert_awaited_once_with("TaiwanStockPrice", "2330", "2026-01-01")
    assert result == {"status": 200, "data": rows}
