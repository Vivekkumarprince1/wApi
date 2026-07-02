import api from './client';

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'full-width-bottom';

export interface WidgetConfig {
  _id?: string;
  widgetId: string;
  workspace?: string;
  enabled: boolean;
  phoneNumber: string;
  position: WidgetPosition;
  color: {
    primary: string;
    secondary: string;
    text: string;
  };
  greeting: {
    enabled: boolean;
    text: string;
    subtext?: string;
  };
  defaultMessage: string;
  behavior: {
    showByDefault: boolean;
    buttonLabel: string;
    allowedPages: string[];
    excludedPages: string[];
    delayBeforeShow: number;
  };
  attribution: {
    enabled: boolean;
    customText?: string;
  };
  usage: {
    sessionsThisMonth: number;
    messagesThisMonth: number;
    uniqueVisitorsThisMonth: number;
    lastActivityAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

const unwrap = <T>(payload: any): T => payload?.data ?? payload;

export const getWidgetConfig = async () => unwrap<WidgetConfig>(await api.get('/widget/config'));
export const updateWidgetConfig = async (data: Partial<WidgetConfig>) =>
  unwrap<WidgetConfig>(await api.post('/widget/config', data));
export const getWidgetEmbed = async () => unwrap<{ embedCode: string; widgetId: string; workspaceId: string; scriptUrl: string }>(
  await api.get('/widget/embed')
);
