import type { NoteLocation } from './api/amapSdk';
import { useState } from 'react';
import { Avatar, ConfigProvider, Segmented } from 'antd';
import { BatteryFull, ChevronLeft, Heart, Signal, Star, Wifi } from 'lucide-react';
import dayjs from 'dayjs';
import { avatarUrl } from '../auth';
import { useAuth } from '../auth/authContext';
import { NotePreview } from './NotePreview';
import { NoteCoverPreview } from './NoteCoverPreview';
import type { NoteRecord } from './noteModels';
import './noteMobilePreview.css';

interface Props {
  record: NoteRecord;
  location?: NoteLocation;
  images: string[];
}

export function NoteMobilePreview({ record, images, location }: Props) {
  const [mode, setMode] = useState<'note' | 'cover'>('note');
  const { user } = useAuth();
  return (
    <aside className="note-mobile-preview" aria-label="手机端预览">
      <ConfigProvider
        theme={{
          token: { controlHeight: 32, borderRadius: 20, borderRadiusSM: 16 },
          components: {
            Segmented: {
              trackBg: '#eeeeef',
              itemSelectedBg: '#fff',
              itemColor: '#4b5563',
              itemSelectedColor: '#172033',
              trackPadding: 4,
            },
          },
        }}
      >
        <Segmented
          block
          styles={{
            root: {
              height: 40,
              padding: 4,
              width: 'var(--note-mobile-width)',
              maxWidth: '100%',
              marginInline: 'auto',
            },
            item: { margin: 0, fontSize: 14 },
            label: { lineHeight: '32px', minHeight: 32 },
          }}
          aria-label="手机端预览模式"
          value={mode}
          options={[
            {
              label: (
                <span
                  style={{
                    color: mode === 'note' ? 'var(--text, #172033)' : '#4b5563',
                    fontWeight: mode === 'note' ? 600 : 400,
                  }}
                >
                  笔记预览
                </span>
              ),
              value: 'note',
            },
            {
              label: (
                <span
                  style={{
                    color: mode === 'cover' ? 'var(--text, #172033)' : '#4b5563',
                    fontWeight: mode === 'cover' ? 600 : 400,
                  }}
                >
                  封面预览
                </span>
              ),
              value: 'cover',
            },
          ]}
          onChange={(value) => setMode(value === 'cover' ? 'cover' : 'note')}
        />
      </ConfigProvider>
      <div className="note-mobile-phone">
        <div className="note-mobile-status" aria-hidden="true">
          <span>9:41</span>
          <span>
            <Signal size={14} />
            <Wifi size={14} />
            <BatteryFull size={18} />
          </span>
        </div>
        <header className="note-mobile-nav">
          {mode === 'note' ? (
            <>
              <ChevronLeft size={18} aria-hidden="true" />
              <Avatar
                size={28}
                src={avatarUrl(user.avatarMediaNo)}
                style={{ background: '#f7e8dc', color: '#8a4b2d' }}
              >
                {user.nickname.slice(0, 1)}
              </Avatar>
              <span>{user.nickname}</span>
            </>
          ) : (
            <strong>发现</strong>
          )}
        </header>
        <div className="note-mobile-screen">
          {mode === 'note' ? (
            <>
              <NotePreview record={record} images={images} location={location} />
              <p className="note-mobile-date">{dayjs(record.date).format('M月D日 HH:mm')}</p>
            </>
          ) : (
            <NoteCoverPreview
              record={record}
              images={images}
              author={user.nickname}
              avatarMediaNo={user.avatarMediaNo}
            />
          )}
        </div>
        {mode === 'note' && (
          <div className="note-mobile-actions" aria-hidden="true">
            <span>
              <Heart size={20} />
              点赞
            </span>
            <span>
              <Star size={20} />
              收藏
            </span>
          </div>
        )}
        <div className="note-mobile-home" aria-hidden="true">
          <span />
        </div>
      </div>
    </aside>
  );
}
