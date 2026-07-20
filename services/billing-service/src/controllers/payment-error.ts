export type PaymentHttpError = {
  status: number;
  body: {
    success: false;
    code: string;
    message: string;
  };
};

export function classifyPaymentError(error: any): PaymentHttpError {
  if (error?.code === 'FEATURE_DISABLED' || error?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
    return {
      status: 503,
      body: {
        success: false,
        code: error.code,
        message: 'Online payments are temporarily unavailable. Please contact support.',
      },
    };
  }

  return {
    status: 502,
    body: {
      success: false,
      code: error?.code || 'PAYMENT_PROVIDER_ERROR',
      message: 'The payment provider could not create the order. Please try again later.',
    },
  };
}