"""refactor_misclassified_images_table

Revision ID: 5317e051b7f6
Revises: a72a2f3f4e88
Create Date: 2026-06-16 10:39:37.826577

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
"""refactor_misclassified_images_table

Revision ID: 5317e051b7f6
Revises: a72a2f3f4e88
Create Date: 2026-06-16 10:39:37.826577

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5317e051b7f6'
down_revision: Union[str, Sequence[str], None] = 'a72a2f3f4e88'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("DROP TABLE IF EXISTS misclassified_images CASCADE")
    op.create_table(
        'misclassified_images',
        sa.Column('image_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('batch_id', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('image_path', sa.String(), nullable=False),
        sa.Column('ground_truth', sa.String(), nullable=False),
        sa.Column('prediction', sa.String(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('error_type', sa.String(), nullable=False)
    )
    op.create_index(op.f('ix_misclassified_images_batch_id'), 'misclassified_images', ['batch_id'], unique=False)
    op.create_index(op.f('ix_misclassified_images_image_id'), 'misclassified_images', ['image_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS misclassified_images CASCADE")
    op.create_table(
        'misclassified_images',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('batch_id', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('ground_truth', sa.String(), nullable=False),
        sa.Column('prediction', sa.String(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('error_type', sa.String(), nullable=False)
    )
    op.create_index(op.f('ix_misclassified_images_batch_id'), 'misclassified_images', ['batch_id'], unique=False)
    op.create_index(op.f('ix_misclassified_images_id'), 'misclassified_images', ['id'], unique=False)
