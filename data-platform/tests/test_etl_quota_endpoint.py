from unittest.mock import AsyncMock, patch


async def test_get_finmind_quota_returns_client_status():
    from app.routers import etl

    expected = {"used": 3, "limit": 600, "remaining": 597, "date": "2026-05-24"}
    with patch("app.routers.etl.get_quota_status", new_callable=AsyncMock, return_value=expected):
        result = await etl.get_finmind_quota()

    assert result == expected
