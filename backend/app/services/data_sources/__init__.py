"""
Data sources module for fetching AV incident data from official sources.

Supported Sources:
- NHTSA Standing General Order (SGO) - ADS and ADAS incident reports
- NHTSA APIs - Complaints, Recalls, FARS
- California DMV - AV Collision Reports  
- California CPUC - Quarterly deployment reports
"""

from .base import DataSourceBase, DataSourceConfig
from .nhtsa_sgo import NHTSASGODataSource
from .nhtsa_api import NHTSAComplaintsAPI, NHTSARecallsAPI, NHTSAFarsAPI
from .california_dmv import CaliforniaDMVDataSource
from .cpuc import CPUCDataSource
from .sync_service import DataSyncService

__all__ = [
    "DataSourceBase",
    "DataSourceConfig",
    "NHTSASGODataSource",
    "NHTSAComplaintsAPI",
    "NHTSARecallsAPI",
    "NHTSAFarsAPI",
    "CaliforniaDMVDataSource",
    "CPUCDataSource",
    "DataSyncService",
]
