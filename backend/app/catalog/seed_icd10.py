"""Seed the icd_catalog table from the bundled TSV.

Run as a script:
    python -m app.catalog.seed_icd10

Idempotent — upserts on `code`. Safe to re-run after pulling a fresh
TSV from CMS. The bundled sample covers the ~50 most common
ambulatory ICD-10-CM codes; swap in the full CMS file (~75k rows)
for production by overwriting `icd10_sample.tsv` or by passing a
different path as the first CLI argument.
"""
from __future__ import annotations

import asyncio
import csv
import sys
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.icd_catalog import IcdCatalog


DEFAULT_TSV = Path(__file__).parent / "icd10_sample.tsv"


async def seed_from_tsv(db: AsyncSession, tsv_path: Path) -> int:
    """Upsert every row in `tsv_path` into icd_catalog. Returns the
    number of rows processed."""
    if not tsv_path.exists():
        raise FileNotFoundError(f"ICD seed file not found: {tsv_path}")

    rows: list[dict[str, str | None]] = []
    with tsv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for r in reader:
            code = (r.get("code") or "").strip()
            if not code:
                continue
            rows.append(
                {
                    "code": code,
                    "short_description": (r.get("short_description") or "").strip(),
                    "long_description": (r.get("long_description") or "").strip() or None,
                    "chapter": (r.get("chapter") or "").strip() or None,
                }
            )

    if not rows:
        return 0

    # PostgreSQL "INSERT ... ON CONFLICT (code) DO UPDATE" — keeps the
    # seed re-runnable.
    stmt = insert(IcdCatalog).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["code"],
        set_={
            "short_description": stmt.excluded.short_description,
            "long_description": stmt.excluded.long_description,
            "chapter": stmt.excluded.chapter,
        },
    )
    await db.execute(stmt)
    await db.commit()
    return len(rows)


async def main(argv: list[str]) -> None:
    tsv_path = Path(argv[1]) if len(argv) > 1 else DEFAULT_TSV
    async with AsyncSessionLocal() as db:
        n = await seed_from_tsv(db, tsv_path)
    print(f"Seeded {n} ICD-10 codes from {tsv_path}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv))
