import os
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "ethara_db")
MONGODB_SERVER_SELECTION_TIMEOUT_MS = int(
    os.getenv("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000")
)

client: Optional[AsyncIOMotorClient] = None
database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    global client, database

    if database is not None:
        return

    client = AsyncIOMotorClient(
        MONGODB_URL,
        serverSelectionTimeoutMS=MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    )
    database = client[DB_NAME]

    try:
        await client.admin.command("ping")
    except PyMongoError:
        client.close()
        client = None
        database = None
        raise


async def close_mongo_connection() -> None:
    global client, database

    if client is not None:
        client.close()
    client = None
    database = None


async def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        await connect_to_mongo()
    if database is None:
        raise RuntimeError("MongoDB is not initialized.")
    return database
