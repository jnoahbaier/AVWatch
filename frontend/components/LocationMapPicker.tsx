'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Props {
  onLocationSelect: (lat: number, lng: number, address: string, city: string) => void;
  selectedLat?: number;
  selectedLng?: number;
}

export function LocationMapPicker({ onLocationSelect, selectedLat, selectedLng }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onSelectRef = useRef(onLocationSelect);
  onSelectRef.current = onLocationSelect;

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
      );
      const data = await res.json();
      const address: string = data.features?.[0]?.place_name ?? '';
      const context: { id: string; text: string }[] = data.features?.[0]?.context ?? [];
      const cityCtx = context.find((c) => c.id.startsWith('place.'));
      onSelectRef.current(lat, lng, address, cityCtx?.text ?? '');
    } catch {
      onSelectRef.current(lat, lng, '', '');
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    let mapboxgl: typeof import('mapbox-gl');
    let map: import('mapbox-gl').Map;

    (async () => {
      mapboxgl = (await import('mapbox-gl')).default as unknown as typeof import('mapbox-gl');
      (mapboxgl as unknown as { accessToken: string }).accessToken =
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

      const validLng =
        selectedLng != null && !isNaN(selectedLng) ? selectedLng : -122.4194;
      const validLat =
        selectedLat != null && !isNaN(selectedLat) ? selectedLat : 37.7749;

      map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [validLng, validLat],
        zoom: 13,
      });
      mapRef.current = map;

      if (selectedLat != null && !isNaN(selectedLat) && selectedLng != null && !isNaN(selectedLng)) {
        markerRef.current = new mapboxgl.Marker({ color: '#3b82f6' })
          .setLngLat([selectedLng, selectedLat])
          .addTo(map);
      }

      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
        } else {
          markerRef.current = new mapboxgl.Marker({ color: '#3b82f6' })
            .setLngLat([lng, lat])
            .addTo(map);
        }
        reverseGeocode(lat, lng);
      });

      // When the parent hides us with display:none and later reveals us,
      // the canvas stays 0×0 until Mapbox is told to resize.
      // A ResizeObserver on the container fires as soon as it becomes visible.
      const ro = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.resize();
      });
      if (mapContainer.current) ro.observe(mapContainer.current);
      (map as unknown as { _ro?: ResizeObserver })._ro = ro; // stash for cleanup
    })();

    return () => {
      const ro = (mapRef.current as unknown as { _ro?: ResizeObserver } | null)?._ro;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1.5">
      <div
        ref={mapContainer}
        className="w-full h-44 rounded-xl overflow-hidden border border-slate-200"
      />
      <p className="text-xs text-slate-400 text-center">Tap anywhere on the map to pin the incident location</p>
    </div>
  );
}
