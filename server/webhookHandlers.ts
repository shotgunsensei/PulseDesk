import { getStripeSync } from './stripeClient';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    let event: any;
    try {
      event = JSON.parse(payload.toString('utf8'));
    } catch (parseErr: any) {
      console.warn('[billingSync] Could not parse webhook payload as JSON:', parseErr.message);
      return;
    }

    try {
      const { syncOrgFromStripeEvent } = await import('./services/billingSync');
      await syncOrgFromStripeEvent(event);
    } catch (syncErr: any) {
      console.error('[billingSync] Error processing billing event:', syncErr.message);
    }
  }
}
