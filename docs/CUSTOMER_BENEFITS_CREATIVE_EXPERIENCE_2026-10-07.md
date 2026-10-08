# CUSTOMER BENEFITS CREATIVE EXPERIENCE — 2026-10-07

## Objective

Restore the previously projected Customer Benefits creative experience inside
LIHEN Control Center · DEV `/customers/benefits`.

The creative layer complements the controlled lifecycle. It does not replace,
activate, redeem, expire, apply or send benefits automatically.

## Historical evidence recovered

The continuity MASTER section `AG.8 UI / CREATIVE / WHATSAPP / PUBLIC HUB`
records the previous design decisions:

- visual benefit generation;
- Beauty Care / Style visual distinction;
- benefit status + WhatsApp message;
- historic number/% overlap fix;
- Web Share with file when supported;
- WhatsApp link text-only;
- guided two-step image/message sharing;
- no auto-send;
- no automatic commercial mutation.

The current `next-phase` retained the controlled lifecycle repository/page but
not the visual/creative presentation.

## Implementation

The experience remains inside `/customers/benefits`.

It now separates:

1. controlled benefit lifecycle;
2. customer-facing visual presentation;
3. browser-local PNG generation;
4. WhatsApp copy preparation;
5. Web Share / download assistance.

No additional application was created.

## Visuals

Two visual themes are provided:

- Beauty Care;
- Style.

The official LIHEN logo asset is reused without reinterpretation.

The visual card contains:

- line;
- translated benefit type;
- discount percentage;
- benefit code;
- customer-facing status;
- validity;
- LIHEN signature.

Internal Customer/Sale/Order UUIDs are not included in the visual asset.

## PNG

PNG generation is browser-local through Canvas.

No new image-generation dependency is required.

The discount and percent sign are rendered as one text token to prevent the
historic number/% overlap regression.

## WhatsApp

The generated WhatsApp message is preparation only.

The flow is:

1. share/download image;
2. copy message;
3. open WhatsApp with text prepared.

The WhatsApp URL is text-only.

No WhatsApp API/runtime execution is invoked.

`MESSAGE GENERATION != SENDING`.

## Customer Master

When readable, Customer Master supplies human-readable customer identity for
the detail panel and greeting.

Customer UUID remains internal.

Creative rendering still works with a neutral greeting if customer identity
cannot be loaded.

## Lifecycle

The existing controlled RPC mapping remains unchanged:

- WELCOME
- PURCHASE_THRESHOLD
- RETURN_AFTER_EXPIRED
- ACTIVATE
- EXPIRE
- APPLY
- REMOVE
- REDEEM

Creative does not call RPCs.

## Governance

- DEV only.
- PROD HOLD.
- main untouched.
- scheduler OFF.
- canary OFF.
- dispatch OFF.
- WhatsApp SEND OFF.
- official WhatsApp ending 4163 untouched.
- no real Meta/TikTok calls.
- FREE_ONLY.
- no service-role browser credential.
- GENERATED != OFFICIAL.
- RECOMMENDATION != EXECUTION.
- MESSAGE GENERATION != SENDING.

## Validation

Pending quality gate and manual DEV smoke.

## Safe DEV preview

Supabase DEV currently has zero persisted `customer_benefits`.

To validate the Creative layer without creating a commercial benefit, the local
development build includes a synthetic preview guarded by `import.meta.env.DEV`.

The preview:

- is browser-local;
- is not persisted;
- does not call benefit RPCs;
- does not create a Customer Master record;
- supports Beauty Care and Style;
- validates PNG, clipboard, Web Share fallback and WhatsApp text preparation.

The preview is excluded from production/GitHub Pages builds.

## LIHEN visual refinement

The Customer Benefit visual language was refined against the supplied LIHEN
identity reference.

The authoritative visual principles applied are:

- pastel blush / pink;
- soft lavender;
- warm cream;
- subtle lime glow;
- copper / gold-like brand accent;
- diffused luminous backgrounds;
- soft organic volumes;
- thin organic contour lines;
- generous negative space;
- feminine premium presentation.

The benefit intentionally avoids a generic coupon / gift-card appearance.

Creative tokens are centralized for Beauty Care and Style so both variants
remain visibly related while preserving a different character.

Beauty Care is softer and more luminous.

Style is slightly more editorial and lavender-led.

The official LIHEN logo remains unchanged.

The HTML preview and Canvas PNG both consume the same visual model and theme
tokens.

The percentage remains one text token to protect the historic number/percent
overlap contract.
