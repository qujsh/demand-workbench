import { useEffect, useRef, useState } from 'react';
import { loadAmap, type AmapSdk, type AmapMap, type NoteLocation, type Poi } from '../api/amapSdk';

function fromPoi(poi: Poi, city: string): NoteLocation | null {
  if (!poi.location || typeof poi.location.getLng !== 'function') return null;
  return {
    name: poi.name,
    address: typeof poi.address === 'string' ? poi.address : '',
    city: poi.cityname || city,
    poiId: poi.id || '',
    longitude: poi.location.getLng(),
    latitude: poi.location.getLat(),
  };
}
/** 将SDK回调隔离在选点流程，序号防止旧搜索或定位覆盖用户后续选择。 */
export function useNoteLocationMap(key: string, initial: NoteLocation | null) {
  const container = useRef<HTMLDivElement>(null);
  const sdk = useRef<AmapSdk | null>(null);
  const map = useRef<AmapMap | null>(null);
  const marker = useRef<InstanceType<AmapSdk['Marker']> | null>(null);
  const sequence = useRef(0);
  const tipSequence = useRef(0);
  const [selected, setSelected] = useState(initial);
  const [results, setResults] = useState<NoteLocation[]>([]);
  const [tips, setTips] = useState<{ value: string }[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [searched, setSearched] = useState(false);
  const initialValue = useRef(initial);
  function place(value: NoteLocation) {
    setSelected(value);
    const center: [number, number] = [value.longitude, value.latitude];
    map.current?.setZoomAndCenter(16, center);
    if (marker.current) marker.current.setPosition(center);
    else if (sdk.current && map.current)
      marker.current = new sdk.current.Marker({ map: map.current, position: center });
  }
  function resolvePoint(position: [number, number], token: number) {
    if (!sdk.current) return;
    new sdk.current.Geocoder({ extensions: 'all', radius: 100 }).getAddress(
      position,
      (status, result) => {
        if (token !== sequence.current) return;
        setBusy(false);
        const address = result.regeocode;
        if (status !== 'complete' || !address) {
          setError('地点解析失败，请重新选点或搜索地点');
          return;
        }
        const city = address.addressComponent?.city;
        place({
          name: address.formattedAddress,
          address: address.formattedAddress,
          city: (typeof city === 'string' ? city : '') || address.addressComponent?.province || '',
          poiId: '',
          longitude: position[0],
          latitude: position[1],
        });
      },
    );
  }
  useEffect(() => {
    if (!key || !container.current) return;
    let disposed = false;
    const requestSequence = sequence;
    const suggestionSequence = tipSequence;
    loadAmap(key)
      .then((api) => {
        if (disposed || !container.current) return;
        sdk.current = api;
        const saved = initialValue.current;
        map.current = new api.Map(container.current, {
          zoom: saved ? 16 : 11,
          viewMode: '2D',
          ...(saved ? { center: [saved.longitude, saved.latitude] as [number, number] } : {}),
        });
        if (saved) place(saved);
        map.current.on('click', (event) => {
          const token = ++sequence.current;
          setBusy(true);
          setError('');
          resolvePoint([event.lnglat.getLng(), event.lnglat.getLat()], token);
        });
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (!disposed) setError(cause instanceof Error ? cause.message : '地图加载失败');
      });
    return () => {
      disposed = true;
      requestSequence.current++;
      suggestionSequence.current++;
      map.current?.destroy();
      map.current = null;
      marker.current = null;
      sdk.current = null;
    };
    // 地图实例只在挂载和显式重试时创建，选点不重建地图。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);
  function search(keyword: string, city: string) {
    const token = ++sequence.current;
    tipSequence.current++;
    setTips([]);
    if (!sdk.current || !keyword.trim()) return;
    setBusy(true);
    setError('');
    setSearched(true);
    setResults([]);
    new sdk.current.PlaceSearch({
      city,
      citylimit: !!city,
      pageSize: 20,
      extensions: 'all',
    }).search(keyword.trim(), (status, result) => {
      if (token !== sequence.current) return;
      setBusy(false);
      if (status === 'no_data') return;
      if (status !== 'complete') {
        setError('地点搜索失败，请检查地图服务配置或稍后重试');
        return;
      }
      setResults(
        (result.poiList?.pois ?? []).flatMap((poi) => {
          const value = fromPoi(poi, city);
          return value ? [value] : [];
        }),
      );
    });
  }
  function suggest(keyword: string, city: string) {
    const token = ++tipSequence.current;
    if (!sdk.current || !keyword.trim()) {
      setTips([]);
      return;
    }
    new sdk.current.AutoComplete({ city, citylimit: !!city }).search(
      keyword.trim(),
      (status, result) => {
        if (token === tipSequence.current)
          setTips(
            status === 'complete'
              ? [...new Set((result.tips ?? []).map((tip) => tip.name))].map((value) => ({ value }))
              : [],
          );
      },
    );
  }
  function locate() {
    const token = ++sequence.current;
    setError('');
    if (!navigator.geolocation || !window.isSecureContext) {
      setError('当前环境不支持定位，请使用HTTPS或localhost访问，也可直接搜索地点');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (token !== sequence.current || !sdk.current) return;
        sdk.current.convertFrom(
          [position.coords.longitude, position.coords.latitude],
          'gps',
          (status, result) => {
            if (token !== sequence.current) return;
            const point = result.locations?.[0];
            if (status !== 'complete' || !point) {
              setBusy(false);
              setError('定位坐标转换失败，请搜索地点');
              return;
            }
            resolvePoint([point.getLng(), point.getLat()], token);
          },
        );
      },
      (cause) => {
        if (token !== sequence.current) return;
        setBusy(false);
        setError(
          cause.code === 1
            ? '定位权限未开启，你仍可搜索并选择地点'
            : '暂时无法获取当前位置，请重试或搜索地点',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
  return {
    container,
    selected,
    results,
    tips,
    ready,
    busy,
    error,
    searched,
    search,
    suggest,
    locate,
    choose: (value: NoteLocation) => {
      sequence.current++;
      setBusy(false);
      setError('');
      place(value);
    },
    retry: () => {
      setError('');
      setReady(false);
      setRetry((value) => value + 1);
    },
  };
}
