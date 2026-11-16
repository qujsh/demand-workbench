import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AutoComplete, Button, Empty, Input, Modal, Select, Spin } from 'antd';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { getAmapConfig, type NoteLocation } from './api/amapSdk';
import { useNoteLocationMap } from './hooks/useNoteLocationMap';
import './noteLocationPicker.css';

interface Props {
  value: NoteLocation | null;
  onSelect: (location: NoteLocation) => void;
  onClose: () => void;
}
export function NoteLocationPicker(props: Props) {
  const config = useQuery({
    queryKey: ['notes', 'amap-config'],
    queryFn: ({ signal }) => getAmapConfig(signal),
    retry: false,
  });
  return (
    <Modal
      open
      title="选择地点"
      width={960}
      zIndex={1700}
      onCancel={props.onClose}
      footer={null}
      destroyOnHidden
    >
      {config.isPending ? (
        <div className="note-location-loading">
          <Spin />
          <span>正在加载地图配置</span>
        </div>
      ) : config.isError ? (
        <Alert
          type="error"
          showIcon
          title="无法加载地图配置"
          description={config.error.message}
          action={<Button onClick={() => void config.refetch()}>重试</Button>}
        />
      ) : !config.data.configured ? (
        <Alert
          type="info"
          showIcon
          title="高德地图尚未配置"
          description="请在后端配置 AMAP_JS_KEY 和 AMAP_SECURITY_CODE，并重启后端服务。配置完成后即可使用地图搜索和浏览器定位。"
          action={<Button onClick={() => void config.refetch()}>重新检查</Button>}
        />
      ) : (
        <LocationMap {...props} apiKey={config.data.key} />
      )}
    </Modal>
  );
}
function LocationMap({ value, onSelect, onClose, apiKey }: Props & { apiKey: string }) {
  const [city, setCity] = useState(value?.city ?? '');
  const [keyword, setKeyword] = useState('');
  const { container: containerRef, ...state } = useNoteLocationMap(apiKey, value);
  const cities = [
    ...new Set([
      '',
      ...(city ? [city] : []),
      '北京',
      '上海',
      '广州',
      '深圳',
      '杭州',
      '成都',
      '南京',
      '武汉',
      '苏州',
      '重庆',
      '西安',
      '长沙',
      '天津',
      '厦门',
      '青岛',
      '宁波',
      '郑州',
      '合肥',
      '济南',
      '福州',
      '昆明',
      '贵阳',
      '南宁',
      '南昌',
      '海口',
      '太原',
      '石家庄',
      '沈阳',
      '大连',
      '长春',
      '哈尔滨',
      '兰州',
      '银川',
      '西宁',
      '乌鲁木齐',
      '拉萨',
      '呼和浩特',
    ]),
  ];
  return (
    <>
      <p className="note-location-intro">搜索地点或点击地图选点，也可以定位到当前位置。</p>
      <div className="note-location-toolbar">
        <Select
          aria-label="搜索城市"
          value={city}
          showSearch
          onChange={setCity}
          options={cities.map((name) => ({ value: name, label: name || '全国' }))}
        />
        <AutoComplete
          value={keyword}
          options={state.tips}
          disabled={!state.ready}
          onChange={setKeyword}
          onSearch={(text) => state.suggest(text, city)}
          onSelect={(text) => state.search(text, city)}
        >
          <Input.Search
            aria-label="搜索地点"
            placeholder="搜索店名、景点或地址"
            maxLength={100}
            enterButton={<Search size={16} aria-label="搜索" />}
            onSearch={() => state.search(keyword, city)}
          />
        </AutoComplete>
        <Button
          icon={<LocateFixed size={16} />}
          disabled={!state.ready}
          loading={state.busy}
          onClick={state.locate}
        >
          定位到我
        </Button>
      </div>
      {state.error && (
        <Alert
          type="warning"
          showIcon
          title={state.error}
          action={
            !state.ready ? (
              <Button size="small" onClick={state.retry}>
                重试
              </Button>
            ) : undefined
          }
        />
      )}
      <div className="note-location-layout">
        <section className="note-location-results" aria-label="地点搜索结果" aria-busy={state.busy}>
          <div className="note-location-results-heading">
            {state.busy
              ? '正在查找地点…'
              : state.searched
                ? `搜索结果 · ${state.results.length}`
                : '选择笔记地点'}
          </div>
          {state.results.length ? (
            state.results.map((place) => (
              <button
                type="button"
                key={place.poiId || `${place.longitude},${place.latitude}`}
                className="note-location-result"
                aria-pressed={state.selected?.poiId === place.poiId}
                onClick={() => state.choose(place)}
              >
                <MapPin size={17} />
                <span>
                  <strong>{place.name}</strong>
                  <small>
                    {place.city} {place.address}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                state.searched && !state.busy
                  ? '未找到地点，请换个关键词或搜索城市'
                  : '搜索地点，或在地图上选点'
              }
            />
          )}
        </section>
        <div className="note-location-map-wrap">
          <div ref={containerRef} className="note-location-map" aria-label="高德地图" />
          {!state.ready && !state.error && (
            <div className="note-location-map-loading">
              <Spin />
              <span>正在加载高德地图</span>
            </div>
          )}
        </div>
      </div>
      <footer className="note-location-footer">
        <div className="note-location-current" aria-live="polite">
          <MapPin size={20} />
          <div>
            <strong>{state.selected?.name || '尚未选择地点'}</strong>
            {state.selected?.address && <p>{state.selected.address}</p>}
          </div>
        </div>
        <div className="note-location-footer-actions">
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            disabled={!state.selected || state.busy}
            onClick={() => {
              if (state.selected) onSelect(state.selected);
            }}
          >
            确认地点
          </Button>
        </div>
      </footer>
    </>
  );
}
