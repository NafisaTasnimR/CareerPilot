import os
import httpx
from dotenv import load_dotenv
from supabase import create_client, ClientOptions
from sqlalchemy.ext.declarative import declarative_base

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

# Force HTTP/1.1 — prevents HTTP/2 stream termination (ConnectionTerminated error_code:0)
custom_httpx_client = httpx.Client(http2=False)

supabase = create_client(
    url,
    key,
    options=ClientOptions(
        httpx_client=custom_httpx_client
    )
)

# SQLAlchemy Base kept for model definitions only (no local DB engine)
Base = declarative_base()