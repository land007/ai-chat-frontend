import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapConfig, MapMarker, MapTrack } from '@/types';

// 修复 Leaflet 默认图标问题
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

// 设置默认图标（仅在客户端执行）
if (typeof window !== 'undefined') {
  try {
    const L = require('leaflet');
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: icon,
      iconRetinaUrl: iconRetina,
      shadowUrl: iconShadow,
    });
  } catch (error) {
    console.warn('[地图] Leaflet 图标设置失败:', error);
  }
}

// 地图控制器组件（用于监听地图事件）
const MapController: React.FC<{
  onMapReady?: (map: any) => void;
}> = ({ onMapReady }) => {
  const map = useMap();

  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  return null;
};

interface MapViewerProps {
  config: MapConfig;
  isDarkMode?: boolean;
}

const MapViewer: React.FC<MapViewerProps> = ({ config, isDarkMode = false }) => {
  const [selectedTrack, setSelectedTrack] = useState<MapTrack | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 深色主题的瓦片图层URL
  const tileLayerUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileLayerAttribution = isDarkMode
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // 处理轨迹点击事件
  const handleTrackClick = useCallback((track: MapTrack) => {
    setSelectedTrack(track);
    console.log('[地图] 轨迹被点击', track);
  }, []);

  // 处理轨迹鼠标悬停
  const handleTrackMouseOver = useCallback((track: MapTrack) => {
    // 可以在这里添加悬停效果
    console.log('[地图] 轨迹鼠标悬停', track);
  }, []);

  // 渲染标记点
  const renderMarkers = () => {
    if (!config.markers || config.markers.length === 0) return null;

    return config.markers.map((marker: MapMarker, index: number) => (
      <Marker key={`marker-${index}`} position={[marker.lat, marker.lng]}>
        <Popup>
          <div>
            {marker.title && <h3 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{marker.title}</h3>}
            {marker.description && <p style={{ margin: 0 }}>{marker.description}</p>}
          </div>
        </Popup>
      </Marker>
    ));
  };

  // 渲染轨迹
  const renderTracks = () => {
    if (!config.tracks || config.tracks.length === 0) return null;

    return config.tracks.map((track: MapTrack, index: number) => {
      const positions: LatLngExpression[] = track.points.map((point) => [point.lat, point.lng]);

      const pathOptions = {
        color: track.color || '#3b82f6',
        weight: track.weight || 3,
        opacity: track.opacity || 0.7,
        dashArray: track.dashArray || undefined,
      };

      return (
        <Polyline
          key={`track-${index}`}
          positions={positions}
          pathOptions={pathOptions}
          eventHandlers={{
            click: () => handleTrackClick(track),
            mouseover: () => handleTrackMouseOver(track),
          }}
        >
          <Popup>
            <div>
              {track.title && <h3 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{track.title}</h3>}
              {track.description && <p style={{ margin: '0 0 8px 0' }}>{track.description}</p>}
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                轨迹点数量: {track.points.length}
              </p>
            </div>
          </Popup>
        </Polyline>
      );
    });
  };

  // 当选中轨迹时，高亮显示并聚焦
  useEffect(() => {
    if (selectedTrack && mapInstance) {
      // 聚焦到轨迹范围
      if (selectedTrack.points.length > 0) {
        // 将轨迹点转换为 [纬度, 经度] 元组数组
        const bounds: [number, number][] = selectedTrack.points.map(
          (point) => [point.lat, point.lng]
        );
        mapInstance.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [selectedTrack, mapInstance]);

  const center: [number, number] = config.center || [39.9, 116.4];
  const zoom = config.zoom || 13;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        margin: '16px 0',
        height: '400px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa',
        border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
      }}
    >
      {/* 选中轨迹信息显示 */}
      {selectedTrack && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            right: '8px',
            zIndex: 1000,
            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            padding: '12px 16px',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            border: `1px solid ${isDarkMode ? '#4b5563' : '#e5e7eb'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              {selectedTrack.title && (
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: isDarkMode ? '#f9fafb' : '#111827',
                  }}
                >
                  {selectedTrack.title}
                </h3>
              )}
              {selectedTrack.description && (
                <p
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '14px',
                    color: isDarkMode ? '#d1d5db' : '#6b7280',
                  }}
                >
                  {selectedTrack.description}
                </p>
              )}
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: isDarkMode ? '#9ca3af' : '#9ca3af',
                }}
              >
                轨迹点: {selectedTrack.points.length} 个
              </p>
            </div>
            <button
              onClick={() => setSelectedTrack(null)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 8px',
                cursor: 'pointer',
                color: isDarkMode ? '#f9fafb' : '#111827',
                fontSize: '18px',
                fontWeight: 'bold',
                borderRadius: '4px',
              }}
              title="关闭"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <MapController onMapReady={setMapInstance} />
        <TileLayer attribution={tileLayerAttribution} url={tileLayerUrl} />
        {renderMarkers()}
        {renderTracks()}
      </MapContainer>
    </div>
  );
};

export default MapViewer;

