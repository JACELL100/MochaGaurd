from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    database_url: str = ''
    supabase_url: str = ''
    supabase_service_role_key: str = ''

    groq_api_key: str = ''
    groq_model: str = 'llama-3.3-70b-versatile'

    alpha_vantage_api_key: str = ''

    sepolia_rpc_url: str = 'https://rpc.sepolia.org'
    anchor_private_key: str = ''
    contract_address: str = ''

    # engine tuning: max_leverage = SAFETY / (adverse_move + slippage)
    safety: float = 0.8
    headline_cap: float = 20.0


settings = Settings()
