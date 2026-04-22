export const PLAN_KEYS = ['free', 'pro', 'pro_plus', 'enterprise', 'unlimited'] as const;
export type PlanKey = typeof PLAN_KEYS[number];

export const BILLING_PLANS: Record<PlanKey, {
  label: string;
  price: number;
  metaKey: string;
  maxMembers: number | typeof Infinity;
  entraEnabled: boolean;
  emailToTicket: boolean;
  priceEnvVar: string | null;
}> = {
  free:       { label: 'Free',       price: 0,   metaKey: 'free',       maxMembers: 5,        entraEnabled: false, emailToTicket: false, priceEnvVar: null },
  pro:        { label: 'Pro',        price: 60,  metaKey: 'pro',        maxMembers: 50,       entraEnabled: true,  emailToTicket: false, priceEnvVar: 'STRIPE_PRICE_ID_PRO' },
  pro_plus:   { label: 'Pro Plus',   price: 80,  metaKey: 'pro_plus',   maxMembers: 100,      entraEnabled: true,  emailToTicket: false, priceEnvVar: 'STRIPE_PRICE_ID_PRO_PLUS' },
  enterprise: { label: 'Enterprise', price: 100, metaKey: 'enterprise', maxMembers: 200,      entraEnabled: true,  emailToTicket: true,  priceEnvVar: 'STRIPE_PRICE_ID_ENTERPRISE' },
  unlimited:  { label: 'Unlimited',  price: 200, metaKey: 'unlimited',  maxMembers: Infinity, entraEnabled: true,  emailToTicket: true,  priceEnvVar: 'STRIPE_PRICE_ID_UNLIMITED' },
};

export const ALLOWED_PLAN_META_KEYS: string[] = ['pro', 'pro_plus', 'enterprise', 'unlimited'];

export function getPlanByMetaKey(key: string): PlanKey | null {
  if (ALLOWED_PLAN_META_KEYS.includes(key)) return key as PlanKey;
  return null;
}

export function getAllowedPlanMetaKeys(): string[] {
  return ALLOWED_PLAN_META_KEYS;
}
