from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "dify"
    db_user: str = "postgres"
    db_password: str = ""  # 必須透過環境變數設定，不提供預設值

    redis_url: str = "redis://localhost:6379/1"

    # Dify 直連（在 docker_default 網路內用容器名）
    dify_internal_url: str = "http://docker-nginx-1/v1"
    dify_api_key: str = ""  # 必須透過環境變數設定

    # TWSE 直連（公開 API，不需代理）
    twse_url: str = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp"

    # FinMind 直連
    finmind_url: str = "https://api.finmindtrade.com/api/v4/data"
    finmind_token: str = ""  # 選填：finmindtrade.com 免費帳號 token，提高 API 限額

    cors_origins: str = "http://localhost:5173,http://localhost:5174"

    # JWT Auth — 必須在生產環境設定強 secret（建議 32+ 字元隨機字串）
    jwt_secret: str = ""  # 必須透過環境變數設定
    jwt_expire_minutes: int = 60  # 縮短為 60 分鐘（原 8 小時過長）

    @field_validator("jwt_secret")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if not v.strip():
            raise ValueError(
                "JWT_SECRET 未設定或為空字串。"
                "請執行: openssl rand -hex 32 並設定 JWT_SECRET 環境變數。"
            )
        if len(v) < 32:
            raise ValueError("JWT_SECRET 長度至少需要 32 個字元以確保安全性。")
        return v

    # Dify Chat mode (set after creating Chat app in Dify UI)
    dify_chat_api_key: str = ""

    # DigiRunner service account
    digirunner_service_url: str = "http://quantdashboardai-digirunner-1:18080"
    digirunner_username: str = "manager"
    digirunner_password: str = ""  # 必須透過環境變數設定

    # 向下相容（若仍有舊程式碼用此變數）
    @property
    def digirunner_url(self) -> str:
        return "http://localhost:31080"

    @property
    def db_dsn(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"  # 忽略未定義的環境變數


settings = Settings()
