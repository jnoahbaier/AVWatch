'use client';

import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set your Mapbox access token here
// (Replace with your actual token or environment variable)
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number; // e.g., number of incidents
}

interface USHeatmapProps {
  data: HeatmapPoint[];
}

export function USHeatmap({ data }: USHeatmapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng] = useState(-98.5833333); // Center of US
  const [lat] = useState(39.8333333); // Center of US
  const [zoom] = useState(3);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11', // Dark theme for modern look
        center: [lng, lat],
        zoom: zoom,
      });

      map.current.on('load', () => {
        if (map.current) {
          map.current.addSource('incidents', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: data.map(point => ({
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [point.longitude, point.latitude]
                },
                properties: {
                  weight: point.weight
                }
              }))
            }
          });

          map.current.addLayer(
            {
              id: 'incidents-heatmap',
              type: 'heatmap',
              source: 'incidents',
              maxzoom: 9,
              paint: {
                // Increase the heatmap weight based on incident density
                'heatmap-weight': ['interpolate', ['linear', ['get', 'weight']], 0, 0, 1, 1],
                // Increase the heatmap color saturation when zoomed in
                'heatmap-intensity': ['interpolate', ['linear', ['zoom']], 0, 1, 9, 3],
                // Color ramp for heatmap.
                // Adjust to match the new blue brand colors.
                'heatmap-color': [
                  'interpolate',
                  ['linear'],
                  ['heatmap-density'],
                  0, 'rgba(0, 0, 0, 0)',
                  0.2, 'rgba(63, 81, 181, 0.5)', // A shade of blue
                  0.4, 'rgba(48, 63, 159, 0.6)', // Darker blue
                  0.6, 'rgba(40, 50, 130, 0.7)', // Even darker blue
                  0.8, 'rgba(20, 30, 90, 0.8)',  // Darkest blue
                  1, 'rgba(0, 0, 50, 0.9)'      // Almost black blue
                ],
                // Adjust radius and opacity as zoom level increases.
                'heatmap-radius': ['interpolate', ['linear', ['zoom']], 0, 2, 9, 20],
                'heatmap-opacity': ['interpolate', ['linear', ['zoom']], 7, 1, 9, 0]
              }
            },
            'waterway-label'
          );
        }
      });
    }
  }, [data, lng, lat, zoom]);

  return (
    <div ref={mapContainer} className="h-[500px] w-full rounded-lg" />
  );
}
