import { getUncachableStripeClient } from './stripeClient';

export async function seedStripeProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    const existingProducts = await stripe.products.search({ query: "name:'TradeFlow Individual'" });
    if (existingProducts.data.length > 0) {
      console.log('Stripe products already exist, skipping seed...');
      return;
    }

    console.log('Creating Stripe products...');

    const individual = await stripe.products.create({
      name: 'TradeFlow Individual',
      description: 'Unlimited customers, jobs, quotes, and invoices for individual tradespeople. No team invites.',
      metadata: { plan: 'individual' },
    });
    await stripe.prices.create({
      product: individual.id,
      unit_amount: 2000,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { plan: 'individual' },
    });

    const smallBusiness = await stripe.products.create({
      name: 'TradeFlow Small Business',
      description: 'Unlimited everything with up to 25 team members for small businesses.',
      metadata: { plan: 'small_business' },
    });
    await stripe.prices.create({
      product: smallBusiness.id,
      unit_amount: 10000,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { plan: 'small_business' },
    });

    const enterprise = await stripe.products.create({
      name: 'TradeFlow Enterprise',
      description: 'Unlimited everything with unlimited team members for large businesses.',
      metadata: { plan: 'enterprise' },
    });
    await stripe.prices.create({
      product: enterprise.id,
      unit_amount: 20000,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { plan: 'enterprise' },
    });

    console.log('Stripe products created successfully!');
  } catch (err: any) {
    console.error('Error seeding Stripe products:', err.message);
  }
}
