import { z } from 'zod';
import { usableEditorialFacts, type EditorialGrounding } from './editorial-grounding';

// Closed neutral editorial vocabulary. These fragments are style, never product evidence.
// The model selects/composes a plan; there is no automatic canned fallback on failure.
export const editorialPhrases = {
  'campaign.focus': 'Una mirada a',
  'campaign.detail': 'El detalle de hoy:',
  'feed.invite': 'Un espacio para descubrir y elegir a tu manera.',
  'feed.question': '¿Qué lugar le darías en tu selección personal?',
  'story.look': 'Una pausa. Una nueva idea.',
  'story.question': '¿Es parte de tu selección?',
  'reel.hook': 'Una idea para tu próxima inspiración:',
  'reel.caption': 'Mira, descubre y elige a tu ritmo.',
  'facebook.context': 'Hoy abrimos la conversación sobre este producto.',
  'facebook.question': '¿Qué te gustaría conocer sobre él?',
  'tiktok.hook': '¿Ya lo conocías?',
  'tiktok.caption': 'Una nueva idea para explorar.',
  'cta.explore': 'Explora este producto',
  'cta.ask': 'Cuéntanos qué te gustaría saber',
  'cta.save': 'Guarda esta idea para inspirarte',
  'cta.discover': 'Descubre más en LIHEN.CO',
  'cta.comment': '¿Lo incluirías en tu selección? Cuéntanos',
} as const;
const fragment = z.union([
  z.object({ fact: z.string().max(160) }).strict(),
  z
    .object({
      editorial: z.enum(
        Object.keys(editorialPhrases) as [
          keyof typeof editorialPhrases,
          ...(keyof typeof editorialPhrases)[],
        ],
      ),
    })
    .strict(),
]);
const textPlan = z.array(fragment).min(1).max(8);
export const groundedPlanSchema = z
  .object({
    productId: z.string().min(1),
    campaignName: textPlan,
    variants: z
      .array(
        z
          .object({
            channel: z.enum([
              'INSTAGRAM_FEED',
              'INSTAGRAM_STORY',
              'INSTAGRAM_REEL',
              'FACEBOOK',
              'TIKTOK',
            ]),
            copy: textPlan,
            callToAction: textPlan,
            hashtags: z.array(z.string().max(160)).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();
export type GroundedEditorialPlan = z.infer<typeof groundedPlanSchema>;

export function renderGroundedPlan(plan: GroundedEditorialPlan, grounding: EditorialGrounding) {
  const used = new Set<string>();
  const facts = new Map(usableEditorialFacts(grounding).map((fact) => [fact.id, fact]));
  const text = (fragments: z.infer<typeof textPlan>) =>
    fragments
      .map((part) => {
        if ('editorial' in part) return editorialPhrases[part.editorial];
        const fact = facts.get(part.fact);
        if (!fact) throw new Error('EDITORIAL_INSUFFICIENT_EVIDENCE');
        used.add(fact.id);
        return fact.value;
      })
      .join(' ');
  const hashtag = (reference: string) => {
    if (reference === 'editorial:lihen') return '#LIHENCO';
    if (reference === 'editorial:inspiration') return '#Inspiracion';
    const fact = facts.get(reference);
    if (
      !fact ||
      fact.trust !== 'VERIFIED_INTERNAL' ||
      !['name', 'brand', 'category'].includes(fact.field)
    )
      throw new Error('EDITORIAL_HASHTAG_INSUFFICIENT_EVIDENCE');
    used.add(fact.id);
    const value = fact.value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '');
    if (!value || value.length > 79) throw new Error('EDITORIAL_HASHTAG_INVALID');
    return `#${value}`;
  };
  if (plan.productId !== grounding.productIdentity.productId)
    throw new Error('EDITORIAL_PRODUCT_IDENTITY_MISMATCH');
  const campaignName = text(plan.campaignName);
  const variants = plan.variants.map((variant) => ({
    channel: variant.channel,
    copy: text(variant.copy),
    callToAction: text(variant.callToAction),
    hashtags: variant.hashtags.map(hashtag),
  }));
  return {
    productId: plan.productId,
    campaignName,
    variants,
    productIdentity: grounding.productIdentity,
    evidence: {
      ...grounding.evidence,
      usedFactIds: [...used],
      editorialContext: 'GENERAL_EDITORIAL_CONTEXT' as const,
    },
  };
}
