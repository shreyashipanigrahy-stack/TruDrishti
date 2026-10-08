"""add ground_truth column to inferences

Revision ID: a3c7e1f9d204
Revises: f8c471ae0648
Create Date: 2026-06-15 12:00:00.000000

Adds an optional ground_truth column (REAL/FAKE/NULL) to the inferences table.
This allows future evaluate-bulk runs to persist labels for true classification
monitoring via Evidently AI. All existing rows default to NULL — no data loss.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c7e1f9d204'
down_revision: Union[str, Sequence[str], None] = 'f8c471ae0648'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nullable ground_truth column to inferences table."""
    op.add_column(
        'inferences',
        sa.Column('ground_truth', sa.String(), nullable=True)
    )


def downgrade() -> None:
    """Drop ground_truth column from inferences table."""
    op.drop_column('inferences', 'ground_truth')
