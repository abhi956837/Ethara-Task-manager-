import os
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "ethara_db")

client: Optional[AsyncIOMotorClient] = None
database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    global client, database

    if database is not None:
        return

    client = AsyncIOMotorClient(MONGODB_URL)
    database = client[DB_NAME]


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
