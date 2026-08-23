/**
 * Published base rates from https://cursor.com/docs/models-and-pricing and
 * linked provider price pages (checked 2026-08-23), in USD per million tokens.
 *
 * The selector needs a stable relative signal, not an estimated bill. Exact
 * spend still depends on the input/output mix, cache use, long context,
 * regional uplifts and plan. Unknown future models therefore get no badge
 * rather than a guessed price.
 */
const MODEL_RATES = Object.freeze({
  'grok-4.6': { input: 2, output: 6, fast: { input: 4, output: 12 } },
  'grok-4.5': { input: 2, output: 6, fast: { input: 4, output: 18 } },
  'composer-2.5': { input: 0.5, output: 2.5, fast: { input: 3, output: 15 } },

  'claude-opus-5': { input: 5, output: 25, fast: { input: 10, output: 50 } },
  'claude-opus-4-8': { input: 5, output: 25, fast: { input: 10, output: 50 } },
  'claude-opus-4-7': { input: 5, output: 25, fast: { input: 30, output: 150 } },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-opus-4-5': { input: 5, output: 25 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },

  'gpt-5.6-sol': { input: 4, output: 20, fast: { input: 8, output: 40 } },
  'gpt-5.6-terra': { input: 2, output: 12, fast: { input: 4, output: 24 } },
  'gpt-5.6-luna': { input: 0.2, output: 1.2, fast: { input: 0.4, output: 2.4 } },
  'gpt-5.5': { input: 5, output: 30 },
  'gpt-5.4': { input: 2.5, output: 15, fast: { input: 5, output: 30 } },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-5.3-codex': { input: 1.75, output: 14 },
  'gpt-5.2': { input: 1.75, output: 14 },
  'gpt-5.1': { input: 1.25, output: 10 },
  'gpt-5-mini': { input: 0.25, output: 2 },

  'gemini-3.7-flash': { input: 0.75, output: 3.5 },
  'gemini-3.6-flash': { input: 1.5, output: 7.5 },
  'gemini-3.5-flash': { input: 1.5, output: 9 },
  'gemini-3.1-pro': { input: 2, output: 12 },
  'gemini-3-flash': { input: 0.5, output: 3 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },

  'kimi-k3': { input: 3, output: 15 },
  'kimi-k2.7-code': { input: 0.95, output: 4 },
  'glm-5.2': { input: 1.4, output: 4.4 },
});

const LEVELS = Object.freeze({
  1: 'lower',
  2: 'moderate',
  3: 'higher',
});

function priceKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^cursor(?:\s+|-)+/, '')
    .replace(/[^a-z0-9]+/g, '');
}

const MODEL_RATE_KEYS = new Map();
for (const stem of Object.keys(MODEL_RATES)) {
  MODEL_RATE_KEYS.set(priceKey(stem), stem);
  if (stem.startsWith('claude-')) MODEL_RATE_KEYS.set(priceKey(stem.slice('claude-'.length)), stem);
}

function displayedRate(modelId, rates) {
  const text = String(modelId || '');
  const fast =
    /(?:^|[,[])fast=true(?:,|]|$)/i.test(text) ||
    (!text.includes('[') && /\bfast\b/i.test(text));
  return fast && rates.fast ? rates.fast : rates;
}

function relativeTier({ input, output }) {
  if (input <= 1.5 && output <= 5) return 1;
  if (input <= 5 && output <= 20) return 2;
  return 3;
}

function dollars(value) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Price metadata for one catalog id, or null when Cursor has not published a
 * rate Auto knows. The three tiers deliberately have wide bands: they should
 * help a choice at a glance without pretending input and output cost the same.
 */
export function modelPrice(modelId) {
  const label = String(modelId || '').replace(/\[.*$/, '');
  const stem = MODEL_RATE_KEYS.get(
    priceKey(label.replace(/\b(?:fast|xhigh|high|medium|low|max)\b/gi, '')),
  );
  const base = MODEL_RATES[stem];
  if (!base) return null;

  const rate = displayedRate(modelId, base);
  const tier = relativeTier(rate);
  const symbols = '$'.repeat(tier);
  const level = LEVELS[tier];
  const variant = rate === base.fast ? ' Fast' : '';
  const rates = `$${dollars(rate.input)}/M input · $${dollars(rate.output)}/M output`;

  return {
    tier,
    symbols,
    level,
    inputPerMillion: rate.input,
    outputPerMillion: rate.output,
    ariaLabel: `${level} relative price, ${rates}${variant}`,
    title: `${symbols} ${level} relative price · ${rates}${variant} · published base rates`,
  };
}
