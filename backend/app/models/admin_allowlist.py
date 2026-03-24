"""
AdminAllowlist model — stores emails permitted to access the admin portal.
"""

from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AdminAllowlist(Base):
    """Email addresses allowed to log into the admin panel."""

    __tablename__ = "admin_allowlist"

    # Email is the natural primary key
    email: Mapped[str] = mapped_column(String(255), primary_key=True)

    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<AdminAllowlist {self.email}>"
