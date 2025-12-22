-- AV Watch Database Initialization
-- This script runs automatically when the PostgreSQL container starts

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE avwatch TO avwatch;

