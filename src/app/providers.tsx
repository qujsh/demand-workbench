import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { AuthGate } from '../features/auth/components/AuthGate';

dayjs.locale('zh-cn');

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#4268f6',
          colorText: '#172033',
          colorBorder: '#e4e8f0',
          borderRadius: 6,
          fontSize: 14,
          lineHeight: 1.428571,
          controlHeight: 36,
          fontWeightStrong: 500,
          fontFamily: '-apple-system-body, ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
        },
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}><AuthGate>{children}</AuthGate></QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
