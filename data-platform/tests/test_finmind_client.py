from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def mock_redis():
    r = AsyncMock()
    r.get = AsyncMock(return_value=None)
    r.incr = AsyncMock(return_value=1)
    r.expire = AsyncMock(return_value=True)
    return r


def _response(status_code=200, payload=None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = payload or {"status": 200, "data": [{"stock_id": "2330"}]}
    resp.raise_for_status = MagicMock()
    return resp


def _mock_client_get(mock_client):
    return mock_client.return_value.__aenter__.return_value.get


async def test_fetch_injects_token_when_configured(mock_redis):
    with (
        patch("app.services.finmind_client.get_redis", new_callable=AsyncMock, return_value=mock_redis),
        patch("app.services.finmind_client.settings") as mock_settings,
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_settings.finmind_token = "my-token"
        mock_settings.finmind_url = "https://example.test/finmind"
        _mock_client_get(mock_client).return_value = _response()

        from app.services import finmind_client

        await finmind_client.fetch("TaiwanStockPrice", "2330", "2026-01-01")

    call = _mock_client_get(mock_client).call_args
    assert call.args[0] == "https://example.test/finmind"
    assert call.kwargs["params"]["token"] == "my-token"


async def test_fetch_omits_token_when_empty(mock_redis):
    with (
        patch("app.services.finmind_client.get_redis", new_callable=AsyncMock, return_value=mock_redis),
        patch("app.services.finmind_client.settings") as mock_settings,
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_settings.finmind_token = ""
        mock_settings.finmind_url = "https://example.test/finmind"
        _mock_client_get(mock_client).return_value = _response()

        from app.services import finmind_client

        await finmind_client.fetch("TaiwanStockPrice", "2330", "2026-01-01")

    call_params = _mock_client_get(mock_client).call_args.kwargs["params"]
    assert "token" not in call_params


async def test_fetch_increments_redis_quota_on_success(mock_redis):
    with (
        patch("app.services.finmind_client.get_redis", new_callable=AsyncMock, return_value=mock_redis),
        patch("app.services.finmind_client.settings") as mock_settings,
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_settings.finmind_token = ""
        mock_settings.finmind_url = "https://example.test/finmind"
        _mock_client_get(mock_client).return_value = _response()

        from app.services import finmind_client

        await finmind_client.fetch("TaiwanStockPrice", "2330", "2026-01-01")

    mock_redis.incr.assert_called_once()
    mock_redis.expire.assert_called_once()


async def test_fetch_raises_quota_exceeded_at_threshold(mock_redis):
    mock_redis.get = AsyncMock(return_value="550")

    with patch("app.services.finmind_client.get_redis", new_callable=AsyncMock, return_value=mock_redis):
        from app.services import finmind_client

        with pytest.raises(finmind_client.QuotaExceededError):
            await finmind_client.fetch("TaiwanStockPrice", "2330", "2026-01-01")

    mock_redis.incr.assert_not_called()


async def test_fetch_retries_on_429_then_succeeds_and_counts_each_response(mock_redis):
    with (
        patch("app.services.finmind_client.get_redis", new_callable=AsyncMock, return_value=mock_redis),
        patch("app.services.finmind_client.settings") as mock_settings,
        patch("app.services.finmind_client.asyncio.sleep", new_callable=AsyncMock),
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_settings.finmind_token = ""
        mock_settings.finmind_url = "https://example.test/finmind"
        _mock_client_get(mock_client).side_effect = [
            _response(status_code=429),
            _response(payload={"status": 200, "data": []}),
        ]

        from app.services import finmind_client

        result = await finmind_client.fetch("TaiwanStockPrice", "2330", "2026-01-01")

    assert result == []
    assert _mock_client_get(mock_client).call_count == 2
    assert mock_redis.incr.call_count == 2
    assert mock_redis.expire.call_count == 2


async def test_fetch_raises_after_three_429s(mock_redis):
    with (
        patch("app.services.finmind_client.get_redis", new_callable=AsyncMock, return_value=mock_redis),
        patch("app.services.finmind_client.settings") as mock_settings,
        patch("app.services.finmind_client.asyncio.sleep", new_callable=AsyncMock),
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_settings.finmind_token = ""
        mock_settings.finmind_url = "https://example.test/finmind"
        _mock_client_get(mock_client).side_effect = [
            _response(status_code=429),
            _response(status_code=429),
            _response(status_code=429),
        ]

        from app.services import finmind_client

        with pytest.raises(RuntimeError, match="429"):
            await finmind_client.fetch("TaiwanStockPrice", "2330", "2026-01-01")

    assert mock_redis.incr.call_count == 3


async def test_fetch_counts_finmind_error_response(mock_redis):
    with (
        patch("app.services.finmind_client.get_redis", new_callable=AsyncMock, return_value=mock_redis),
        patch("app.services.finmind_client.settings") as mock_settings,
        patch("httpx.AsyncClient") as mock_client,
    ):
        mock_settings.finmind_token = ""
        mock_settings.finmind_url = "https://example.test/finmind"
        _mock_client_get(mock_client).return_value = _response(
            payload={"status": 400, "msg": "bad request", "data": []}
        )

        from app.services import finmind_client

        with pytest.raises(ValueError, match="bad request"):
            await finmind_client.fetch("TaiwanStockPrice", "2330", "2026-01-01")

    mock_redis.incr.assert_called_once()


async def test_get_quota_status_returns_zero_when_no_usage(mock_redis):
    mock_redis.get = AsyncMock(return_value=None)

    with patch("app.services.finmind_client.get_redis", new_callable=AsyncMock, return_value=mock_redis):
        from app.services import finmind_client

        status = await finmind_client.get_quota_status()

    assert status["used"] == 0
    assert status["limit"] == 600
    assert status["remaining"] == 600
    assert "date" in status


async def test_get_quota_status_calculates_remaining(mock_redis):
    mock_redis.get = AsyncMock(return_value="42")

    with patch("app.services.finmind_client.get_redis", new_callable=AsyncMock, return_value=mock_redis):
        from app.services import finmind_client

        status = await finmind_client.get_quota_status()

    assert status["used"] == 42
    assert status["remaining"] == 558
