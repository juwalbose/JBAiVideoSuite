from prisma import Prisma

db = Prisma()

async def get_db():
    # Ensure the database is connected before yielding
    if not db.is_connected:
        await db.connect()
    yield db


