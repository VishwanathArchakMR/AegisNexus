import asyncio
from app.database import engine, Base
from app.simulation.seed_data import seed_database
# Need to import all models to ensure they are registered with Base
import app.models

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_database()

if __name__ == "__main__":
    asyncio.run(main())
