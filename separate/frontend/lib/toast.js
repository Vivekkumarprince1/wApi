import { toast as hotToast } from 'react-hot-toast';

export const toast = Object.assign(hotToast, {
  success: hotToast.success,
  error: hotToast.error,
  info: (msg, opts) => hotToast(msg, { icon: 'ℹ️', ...opts }),
  warning: (msg, opts) => hotToast(msg, { icon: '⚠️', ...opts }),
  warn: (msg, opts) => hotToast(msg, { icon: '⚠️', ...opts })
});

export default toast;
