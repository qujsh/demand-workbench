import { z } from 'zod';
import { requestJson, buildApiUrl } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

export const noteLocationSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(300),
  city: z.string().max(100),
  poiId: z.string().max(100),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});
export type NoteLocation = z.infer<typeof noteLocationSchema>;
export function getAmapConfig(signal?: AbortSignal) {
  return requestJson(
    '/api/v1/b/maps/amap/config',
    apiResponseSchema(z.object({ configured: z.boolean(), key: z.string() })),
    { signal },
  );
}
export interface LngLat {
  getLng(): number;
  getLat(): number;
}
export interface Poi {
  id?: string;
  name: string;
  address?: string | string[];
  cityname?: string;
  location?: LngLat;
}
export interface AmapMap {
  destroy(): void;
  setZoomAndCenter(zoom: number, center: [number, number]): void;
  on(event: 'click', callback: (event: { lnglat: LngLat }) => void): void;
}
interface Marker {
  setPosition(position: [number, number]): void;
  setMap(map: AmapMap | null): void;
}
interface SearchResult {
  poiList?: { pois?: Poi[] };
  tips?: Poi[];
  info?: string;
}
export interface GeocodeResult {
  regeocode?: {
    formattedAddress: string;
    addressComponent?: { city?: string | string[]; province?: string };
    pois?: Poi[];
  };
}
type SearchCallback = (status: string, result: SearchResult) => void;
export interface AmapSdk {
  Map: new (
    element: HTMLElement,
    options: { zoom: number; center?: [number, number]; viewMode: '2D' },
  ) => AmapMap;
  Marker: new (options: { map: AmapMap; position: [number, number] }) => Marker;
  PlaceSearch: new (options: {
    city: string;
    citylimit: boolean;
    pageSize: number;
    extensions: string;
  }) => { search(keyword: string, callback: SearchCallback): void };
  AutoComplete: new (options: { city: string; citylimit: boolean }) => {
    search(keyword: string, callback: SearchCallback): void;
  };
  Geocoder: new (options: { extensions: string; radius: number }) => {
    getAddress(
      position: [number, number],
      callback: (status: string, result: GeocodeResult) => void,
    ): void;
  };
  convertFrom(
    position: [number, number],
    source: 'gps',
    callback: (status: string, result: { locations?: LngLat[] }) => void,
  ): void;
}
declare global {
  interface Window {
    AMap?: AmapSdk;
    _AMapSecurityConfig?: { serviceHost: string };
    noteAmapReady?: () => void;
  }
}
let loading: Promise<AmapSdk> | undefined;
/** 按需加载官方在线SDK；密钥代理配置必须在SDK加载之前完成。 */
export function loadAmap(key: string): Promise<AmapSdk> {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (loading) return loading;
  window._AMapSecurityConfig = { serviceHost: new URL('/_AMapService', buildApiUrl('/')).href };
  loading = new Promise<AmapSdk>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      delete window.noteAmapReady;
      loading = undefined;
      reject(new Error('高德地图加载失败，请检查网络及Key配置后重试'));
    };
    const timer = window.setTimeout(fail, 15000);
    window.noteAmapReady = () => {
      clearTimeout(timer);
      delete window.noteAmapReady;
      if (window.AMap) resolve(window.AMap);
      else fail();
    };
    script.src =
      'https://webapi.amap.com/maps?' +
      new URLSearchParams({
        v: '2.0',
        key,
        callback: 'noteAmapReady',
        plugin: 'AMap.PlaceSearch,AMap.AutoComplete,AMap.Geocoder',
      });
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
