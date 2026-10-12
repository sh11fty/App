export type Mode = 'mock' | 'test' | 'live';

export interface Config {
  port: number;
  dataFile: string;
  allowLive: boolean;
  vendor: { vendorId: string; product: string; version: string; declarantName: string };
  hmrc: { senderId: string; password: string };
  companiesHouse: { senderId: string; password: string };
  endpoints: Record<Mode, { hmrc: string; companiesHouse: string }>;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 4000),
    dataFile: env.DATA_FILE ?? 'data/history.json',
    allowLive: env.ENABLE_LIVE === 'true',
    vendor: {
      vendorId: env.VENDOR_ID ?? '0000',
      product: 'LtdFiler',
      version: '0.1.0',
      declarantName: env.DECLARANT_NAME ?? '',
    },
    hmrc: { senderId: env.HMRC_SENDER_ID ?? '', password: env.HMRC_PASSWORD ?? '' },
    companiesHouse: { senderId: env.CH_PRESENTER_ID ?? '', password: env.CH_AUTH_CODE ?? '' },
    endpoints: {
      mock: { hmrc: '', companiesHouse: '' },
      test: {
        hmrc: env.HMRC_TEST_URL ?? 'https://test-transaction-engine.tax.service.gov.uk/submission',
        companiesHouse: env.CH_TEST_URL ?? 'http://xmlgw.companieshouse.gov.uk/v1-0/xmlgw/Gateway',
      },
      live: {
        hmrc: env.HMRC_LIVE_URL ?? 'https://transaction-engine.tax.service.gov.uk/submission',
        companiesHouse: env.CH_LIVE_URL ?? 'http://xmlgw.companieshouse.gov.uk/v1-0/xmlgw/Gateway',
      },
    },
  };
}
