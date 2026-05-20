import { Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';

export const webhookController = {
  /**
   * Compatibility endpoint: provider webhook verification now belongs to bsp-service.
   */
  async verifyWhatsApp(req: Request, res: Response) {
    try {
      const response = await axios.get(`${config.bspServiceUrl.replace(/\/$/, '')}/webhooks/gupshup`, {
        params: req.query,
        timeout: 10000,
        validateStatus: () => true,
      });
      return res.status(response.status).send(response.data);
    } catch (error: any) {
      console.error('[Webhook:Verify] BSP proxy failed:', error.message);
      return res.status(502).send('BSP webhook service unavailable');
    }
  },

  /**
   * Compatibility endpoint: raw provider webhook intake is delegated to bsp-service.
   */
  async handleWhatsApp(req: Request, res: Response) {
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const response = await axios.post(`${config.bspServiceUrl.replace(/\/$/, '')}/webhooks/gupshup`, rawBody, {
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          'x-gupshup-signature': String(req.headers['x-gupshup-signature'] || ''),
          'x-hub-signature-256': String(req.headers['x-hub-signature-256'] || ''),
          'x-delivery-id': String(req.headers['x-delivery-id'] || ''),
          'x-request-id': String(req.headers['x-request-id'] || ''),
          'x-message-id': String(req.headers['x-message-id'] || ''),
          'x-gupshup-message-id': String(req.headers['x-gupshup-message-id'] || ''),
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      return res.status(response.status).send(response.data);
    } catch (error: any) {
      console.error('[Webhook] BSP proxy failed:', error.message);
      return res.status(502).send('BSP webhook service unavailable');
    }
  },

  async handleRazorpay(req: Request, res: Response) {
    res.status(200).send('OK');
  }
};
