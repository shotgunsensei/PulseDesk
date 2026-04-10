import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log('Creating PulseDesk subscription products...');

    const existingProducts = await stripe.products.search({
      query: "name:'PulseDesk Pro' AND active:'true'"
    });

    if (existingProducts.data.length > 0) {
      console.log('Products already exist. Skipping creation.');
      return;
    }

    const proPlan = await stripe.products.create({
      name: 'PulseDesk Pro',
      description: 'Professional plan: 25 team members, unlimited tickets, priority support',
      metadata: {
        plan: 'pro',
        maxMembers: '25',
        maxTickets: 'unlimited',
      },
    });
    console.log(`Created product: ${proPlan.name} (${proPlan.id})`);

    const proMonthly = await stripe.prices.create({
      product: proPlan.id,
      unit_amount: 4900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`Created Pro monthly price: $49.00/month (${proMonthly.id})`);

    const proYearly = await stripe.prices.create({
      product: proPlan.id,
      unit_amount: 47000,
      currency: 'usd',
      recurring: { interval: 'year' },
    });
    console.log(`Created Pro yearly price: $470.00/year (${proYearly.id})`);

    const enterprisePlan = await stripe.products.create({
      name: 'PulseDesk Enterprise',
      description: 'Enterprise plan: unlimited members, unlimited tickets, dedicated support, SLA',
      metadata: {
        plan: 'enterprise',
        maxMembers: 'unlimited',
        maxTickets: 'unlimited',
      },
    });
    console.log(`Created product: ${enterprisePlan.name} (${enterprisePlan.id})`);

    const enterpriseMonthly = await stripe.prices.create({
      product: enterprisePlan.id,
      unit_amount: 14900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`Created Enterprise monthly price: $149.00/month (${enterpriseMonthly.id})`);

    const enterpriseYearly = await stripe.prices.create({
      product: enterprisePlan.id,
      unit_amount: 142000,
      currency: 'usd',
      recurring: { interval: 'year' },
    });
    console.log(`Created Enterprise yearly price: $1420.00/year (${enterpriseYearly.id})`);

    console.log('Products and prices created successfully!');
    console.log('Webhooks will sync this data to your database automatically.');
  } catch (error: any) {
    console.error('Error creating products:', error.message);
    process.exit(1);
  }
}

createProducts();
