'use client';

import { useState, useEffect, useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl';
import { Filter, Layers, X, RefreshCw, Loader2 } from 'lucide-react';
import {
  INCIDENT_TYPE_LABELS,
  AV_COMPANY_LABELS,
  INCIDENT_TYPE_COLORS,
  DATA_SOURCE_LABELS,
  DATA_SOURCE_COLORS,
  formatRelativeTime,
} from '@/lib/utils';
import { getIncidents, type Incident } from '@/lib/supabase';

// San Francisco center coordinates
const SF_CENTER = {
  latitude: 37.7749,
  longitude: -122.4194,
};

export default function MapPage() {
  const [viewState, setViewState] = useState({
    ...SF_CENTER,
    zoom: 12,
  });
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<{
    longitude: number;
    latitude: number;
    pointCount: number;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    incident_types: Object.keys(INCIDENT_TYPE_LABELS),
    companies: Object.keys(AV_COMPANY_LABELS),
    sources: Object.keys(DATA_SOURCE_LABELS),
  });

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getIncidents({ limit: 500 });
      setIncidents(data);
    } catch (error) {
      console.error('Failed to load incidents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const filteredIncidents = incidents.filter(
    (incident) =>
      filters.incident_types.includes(incident.incident_type) &&
      filters.companies.includes(incident.av_company || 'unknown') &&
      filters.sources.includes(incident.source || 'user_report')
  );

  const toggleFilter = (type: 'incident_types' | 'companies' | 'sources', value: string) => {
    setFilters((prev) => {
      const current = prev[type];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  // Prepare GeoJSON for clustering
  const geojsonData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: filteredIncidents.map((incident) => ({
      type: 'Feature',
      properties: {
        id: incident.id,
        incident_type: incident.incident_type,
        av_company: incident.av_company,
        description: incident.description,
        occurred_at: incident.occurred_at,
        status: incident.status,
        source: incident.source,
      },
      geometry: {
        type: 'Point',
        coordinates: [incident.longitude, incident.latitude],
      },
    })),
  };

  const clusterLayer: mapboxgl.CircleLayerSpecification = {
    id: 'clusters',
    type: 'circle',
    source: 'incidents',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#22c55e',
        10,
        '#f59e0b',
        50,
        '#ef4444',
      ],
      'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  };

  const clusterCountLayer: mapboxgl.SymbolLayerSpecification = {
    id: 'cluster-count',
    type: 'symbol',
    source: 'incidents',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 14,
    },
    paint: {
      'text-color': '#ffffff',
    },
  };

  const unclusteredPointLayer: mapboxgl.CircleLayerSpecification = {
    id: 'unclustered-point',
    type: 'circle',
    source: 'incidents',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'match',
        ['get', 'incident_type'],
        'collision',
        INCIDENT_TYPE_COLORS.collision,
        'near_miss',
        INCIDENT_TYPE_COLORS.near_miss,
        'sudden_behavior',
        INCIDENT_TYPE_COLORS.sudden_behavior,
        'blockage',
        INCIDENT_TYPE_COLORS.blockage,
        INCIDENT_TYPE_COLORS.other,
      ],
      'circle-radius': 10,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  };

  return (
    <div className="h-[calc(100vh-4rem)] relative">
      {/* Map */}
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={['unclustered-point', 'clusters']}
        cursor="pointer"
        onMouseMove={(e) => {
          const feature = e.features?.[0];
          if (!feature) {
            setSelectedIncident(null);
            setHoveredCluster(null);
            return;
          }
          
          if (feature.layer?.id === 'unclustered-point') {
            const incident = incidents.find(
              (inc) => inc.id === feature.properties?.id
            );
            if (incident) {
              setSelectedIncident(incident);
              setHoveredCluster(null);
            }
          } else if (feature.layer?.id === 'clusters') {
            const coordinates = (feature.geometry as GeoJSON.Point).coordinates;
            const pointCount = feature.properties?.point_count || 0;
            setHoveredCluster({
              longitude: coordinates[0],
              latitude: coordinates[1],
              pointCount,
            });
            setSelectedIncident(null);
          }
        }}
        onMouseLeave={() => {
          setSelectedIncident(null);
          setHoveredCluster(null);
        }}
      >
        <NavigationControl position="top-right" />

        <Source
          id="incidents"
          type="geojson"
          data={geojsonData}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>

        {/* Selected Incident Popup (on hover) */}
        {selectedIncident && (
          <Popup
            latitude={selectedIncident.latitude}
            longitude={selectedIncident.longitude}
            anchor="bottom"
            onClose={() => setSelectedIncident(null)}
            closeButton={false}
            className="!max-w-sm pointer-events-none"
            offset={15}
          >
            <div className="p-4 min-w-[280px]">
              <div className="flex items-start gap-2 mb-3">
                <span
                  className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${INCIDENT_TYPE_COLORS[selectedIncident.incident_type]}20`,
                    color: INCIDENT_TYPE_COLORS[selectedIncident.incident_type],
                  }}
                >
                  {INCIDENT_TYPE_LABELS[selectedIncident.incident_type]}
                </span>
              </div>

              {selectedIncident.description && (
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 line-clamp-3">
                  {selectedIncident.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-400">
                  {AV_COMPANY_LABELS[selectedIncident.av_company || 'unknown']}
                </span>
                <span 
                  className="px-2 py-1 rounded"
                  style={{
                    backgroundColor: `${DATA_SOURCE_COLORS[selectedIncident.source] || '#94a3b8'}20`,
                    color: DATA_SOURCE_COLORS[selectedIncident.source] || '#94a3b8',
                  }}
                >
                  {DATA_SOURCE_LABELS[selectedIncident.source] || selectedIncident.source}
                </span>
                <span
                  className={`px-2 py-1 rounded ${
                    selectedIncident.status === 'verified'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : selectedIncident.status === 'corroborated'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  {selectedIncident.status}
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 flex items-center justify-between text-xs text-slate-500">
                <span>{selectedIncident.city}</span>
                <span>{formatRelativeTime(selectedIncident.occurred_at)}</span>
              </div>

              {(selectedIncident.fatalities > 0 || selectedIncident.injuries > 0) && (
                <div className="mt-3 flex gap-4 text-xs">
                  {selectedIncident.fatalities > 0 && (
                    <span className="text-red-600 font-medium">
                      {selectedIncident.fatalities} fatalities
                    </span>
                  )}
                  {selectedIncident.injuries > 0 && (
                    <span className="text-orange-600 font-medium">
                      {selectedIncident.injuries} injuries
                    </span>
                  )}
                </div>
              )}
            </div>
          </Popup>
        )}

        {/* Cluster Popup (on hover) */}
        {hoveredCluster && (
          <Popup
            latitude={hoveredCluster.latitude}
            longitude={hoveredCluster.longitude}
            anchor="bottom"
            onClose={() => setHoveredCluster(null)}
            closeButton={false}
            className="!max-w-xs pointer-events-none"
            offset={25}
          >
            <div className="p-3 text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                {hoveredCluster.pointCount}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                incidents in this area
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Zoom in to see details
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Filter Toggle Button */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
      >
        <Filter className="w-4 h-4" />
        Filters
        {(filters.incident_types.length < Object.keys(INCIDENT_TYPE_LABELS).length ||
          filters.companies.length < Object.keys(AV_COMPANY_LABELS).length ||
          filters.sources.length < Object.keys(DATA_SOURCE_LABELS).length) && (
          <span className="w-2 h-2 bg-green-500 rounded-full" />
        )}
      </button>

      {/* Refresh Button */}
      <button
        onClick={loadIncidents}
        disabled={loading}
        className="absolute top-4 left-32 flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
      </button>

      {/* Filter Panel */}
      {showFilters && (
        <div className="absolute top-16 left-4 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Incident Types */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Incident Type
              </p>
              <button
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    incident_types: Object.keys(INCIDENT_TYPE_LABELS),
                  }))
                }
                className="text-xs text-green-600 hover:text-green-500"
              >
                Select all
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.incident_types.includes(value)}
                    onChange={() => toggleFilter('incident_types', value)}
                    className="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500"
                  />
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: INCIDENT_TYPE_COLORS[value] }}
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Companies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Company
              </p>
              <button
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    companies: Object.keys(AV_COMPANY_LABELS),
                  }))
                }
                className="text-xs text-green-600 hover:text-green-500"
              >
                Select all
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(AV_COMPANY_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.companies.includes(value)}
                    onChange={() => toggleFilter('companies', value)}
                    className="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Data Sources */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Data Source
              </p>
              <button
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    sources: Object.keys(DATA_SOURCE_LABELS),
                  }))
                }
                className="text-xs text-green-600 hover:text-green-500"
              >
                Select all
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(DATA_SOURCE_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.sources.includes(value)}
                    onChange={() => toggleFilter('sources', value)}
                    className="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500"
                  />
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: DATA_SOURCE_COLORS[value] }}
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          <button
            onClick={() =>
              setFilters({
                incident_types: [],
                companies: [],
                sources: [],
              })
            }
            className="mt-4 w-full py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg transition"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Legend
          </span>
        </div>
        <div className="space-y-1.5">
          {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
            <div key={value} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: INCIDENT_TYPE_COLORS[value] }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Badge */}
      <div className="absolute bottom-4 right-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-4 py-2">
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          {filteredIncidents.length}
        </span>
        <span className="text-sm text-slate-500 ml-1">
          of {incidents.length} incidents
        </span>
      </div>
    </div>
  );
}
