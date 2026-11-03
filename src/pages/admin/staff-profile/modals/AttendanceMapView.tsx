// @ts-nocheck
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { ATTENDANCE_SERVER_URL } from '@/services/server';
import { MapPin, Clock, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AttendanceMapViewProps {
    attendance?: any[];
    user?: any;
    attendanceLoading?: boolean;
}

export default function AttendanceMapView({ attendance = [], user, attendanceLoading = false }: AttendanceMapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);

    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const punchItems = useMemo(() => {
        if (!attendance || !Array.isArray(attendance)) return [];
        return attendance
            .filter((item) => item.TP === 'in' || item.TP === 'out')
            .map((item, index) => {
                const lat = parseFloat(item.geo_lat || (item.geo_point?.coordinates && item.geo_point.coordinates[1]));
                const lng = parseFloat(item.geo_long || (item.geo_point?.coordinates && item.geo_point.coordinates[0]));
                const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

                return {
                    ...item,
                    originalIndex: index,
                    lat: hasValidCoords ? lat : null,
                    lng: hasValidCoords ? lng : null,
                    hasValidCoords,
                };
            });
    }, [attendance]);

    const mappedItems = useMemo(() => {
        return punchItems.filter((i) => i.hasValidCoords);
    }, [punchItems]);

    useEffect(() => {
        let isMounted = true;
        loadGoogleMaps()
            .then((googleMaps) => {
                if (!isMounted || !mapRef.current) return;
                setIsMapLoaded(true);

                const center = mappedItems.length > 0
                    ? { lat: mappedItems[0].lat, lng: mappedItems[0].lng }
                    : { lat: 26.9124, lng: 75.7873 };

                const map = new googleMaps.Map(mapRef.current, {
                    center,
                    zoom: mappedItems.length > 0 ? 14 : 10,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true,
                });
                mapInstanceRef.current = map;

                // Clear existing markers
                markersRef.current.forEach((m) => m.setMap(null));
                markersRef.current = [];

                if (mappedItems.length === 0) return;

                const bounds = new googleMaps.LatLngBounds();

                mappedItems.forEach((item, idx) => {
                    const position = { lat: item.lat, lng: item.lng };
                    bounds.extend(position);

                    const isIn = item.TP === 'in';
                    const markerColor = isIn ? '#10b981' : '#ef4444';

                    const marker = new googleMaps.Marker({
                        position,
                        map,
                        title: `${isIn ? 'Punch IN' : 'Punch OUT'} - ${item.time || ''}`,
                        icon: {
                            path: googleMaps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: markerColor,
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: '#ffffff',
                        },
                    });

                    marker.addListener('click', () => {
                        setSelectedItem(item);
                    });

                    markersRef.current.push(marker);
                });

                if (mappedItems.length > 1) {
                    map.fitBounds(bounds);
                }
            })
            .catch((err) => {
                if (isMounted) setMapError(err.message || 'Failed to load map');
            });

        return () => {
            isMounted = false;
        };
    }, [mappedItems]);

    return (
        <div className="space-y-3">
            <div className="relative w-full h-[320px] rounded-xl overflow-hidden border border-border bg-muted">
                {attendanceLoading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-xs text-xs text-muted-foreground">
                        Loading map locations...
                    </div>
                )}
                {mapError && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-muted p-4 text-center">
                        <AlertCircle className="size-8 text-amber-500 mb-2" />
                        <p className="text-xs text-muted-foreground">Unable to display Google Maps: {mapError}</p>
                    </div>
                )}
                <div ref={mapRef} className="size-full" />
            </div>

            {/* Punches List */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Punches on this day ({punchItems.length})
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {punchItems.map((item, idx) => {
                        const isIn = item.TP === 'in';
                        return (
                            <div
                                key={idx}
                                onClick={() => {
                                    if (item.hasValidCoords && mapInstanceRef.current) {
                                        mapInstanceRef.current.panTo({ lat: item.lat, lng: item.lng });
                                        mapInstanceRef.current.setZoom(16);
                                        setSelectedItem(item);
                                    }
                                }}
                                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                                    selectedItem === item
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border bg-card hover:bg-muted/50 cursor-pointer'
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Badge
                                        variant="outline"
                                        className={
                                            isIn
                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]'
                                        }
                                    >
                                        {isIn ? 'IN' : 'OUT'}
                                    </Badge>
                                    <span className="font-semibold text-foreground truncate">
                                        {item.geo_address || (item.hasValidCoords ? `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` : 'Location not recorded')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-muted-foreground font-mono text-[11px]">
                                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </span>
                                    {item.hasValidCoords && (
                                        <a
                                            href={`https://www.google.com/maps?q=${item.lat},${item.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:text-primary/80"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {punchItems.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No punch recordings available for this day.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
