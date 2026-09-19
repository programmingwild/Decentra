"""Seed the ONE demo account for presentations and trial deploys.

Creates (idempotently):
  - user  demo@decentra.ai / demo1234
  - org   "Demo Workspace" (user is ADMIN)
  - dataset from samples/sales_demo.csv (+ quality report)

So the full workflow is clickable immediately: quality → KPIs → anomalies →
predictions → assistant. No mock transcripts, no fake dialogue — the dataset
is real generated data and every insight is computed from it.

Usage (local):
    cd apps/api && python seed_demo.py

Usage (cloud one-off, e.g. Railway):
    python seed_demo.py   (with DATABASE_URL / STORAGE_PATH set)
"""
import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from sqlalchemy import select  # noqa: E402

from app.auth.security import hash_password  # noqa: E402
from app.database.base import Base  # noqa: E402
from app.database.session import engine, async_session  # noqa: E402
from app.models.entities import (  # noqa: E402
    User, Organization, OrganizationMember, Dataset,
)
from app.services.ingestion import process_upload  # noqa: E402
from app.services.quality import generate_quality_report  # noqa: E402

DEMO_EMAIL = "demo@decentra.ai"
DEMO_PASSWORD = "demo1234"
CSV_PATH = pathlib.Path(__file__).resolve().parent.parent.parent / "samples" / "sales_demo.csv"


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        existing = (await db.execute(select(User).where(User.email == DEMO_EMAIL))).scalar_one_or_none()
        if existing:
            print(f"Demo user {DEMO_EMAIL} already exists — nothing to do.")
            return

        user = User(email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD), full_name="Demo User")
        db.add(user)
        await db.flush()
        org = Organization(name="Demo Workspace", slug="demo", created_by=user.id)
        db.add(org)
        await db.flush()
        db.add(OrganizationMember(org_id=org.id, user_id=user.id, role="ADMIN"))
        await db.commit()

        raw = CSV_PATH.read_bytes()
        dataset, df = await process_upload(raw, CSV_PATH.name, org.id, user.id,
                                           "Sales demo", "Seeded demo dataset", db)
        try:
            report = await generate_quality_report(dataset.id, df, db)
            print(f"Quality score: {report.score}")
        except Exception as e:  # quality must never block seeding
            print(f"Quality report skipped: {e}")

        print(f"Seeded {DEMO_EMAIL} / org {org.slug} / dataset {dataset.id} ({dataset.row_count} rows)")


if __name__ == "__main__":
    asyncio.run(main())
