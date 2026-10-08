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

## LIHEN Intelligence brand governance integration

The Customer Benefits Creative experience now consumes the canonical
brand-governance contract from `@lihen/intelligence-core`.

Creative QA exposes:

- canonical LIHEN brand context;
- brand check;
- logo integrity;
- PREPARED_ONLY execution state.

The official LIHEN logo source asset remains unchanged.

The source PNG contains an opaque light canvas that is visually undesirable
over the LIHEN pastel treatment. The presentation layer therefore uses
multiply composition in both HTML and Canvas export.

This neutralizes the accidental light background while preserving the original
logo artwork, colors and proportions.

No alternate or redesigned logo is introduced.

`BACKGROUND NEUTRALIZATION != LOGO REDESIGN`.

## Card composition restoration and line differentiation

The benefit card now enforces an explicit brand-safe logo scale.

The official LIHEN logo remains unchanged and continues using presentation-time
background neutralization, but it is constrained to a header role rather than
dominating the creative.

The HTML preview targets roughly 25–36% of the card width for the logo
container, while Canvas export uses a 190px logo width on the 1080px canvas.

The complete benefit hierarchy remains visible:

- official logo;
- Beauty Care / Style line;
- emotional copy;
- benefit type;
- discount;
- code;
- validity;
- status;
- CTA;
- LIHEN signature.

Beauty Care now emphasizes blush, warm cream, organic curves and a subtle soft
lime glow.

Style now emphasizes lavender, nude, editorial geometry and finer fashion-like
line work.

Both variants remain under the canonical LIHEN brand context and preserve
`PREPARED_ONLY`.

## Premium coupon redesign

The previous flat customer-facing representation was rejected during manual
visual review.

The Customer Benefit now renders as a complete promotional coupon rather than a
series of loose labels.

The coupon contains:

- official LIHEN header;
- emotional headline;
- benefit title;
- dedicated discount ticket;
- prominent exclusive-code panel;
- validity and status panel;
- emotional closing;
- official LIHEN signature.

Creative QA and sharing controls remain operator-facing and are not part of the
customer-facing coupon.

Beauty Care uses blush / warm cream / organic decoration.

Style keeps the same architecture while using lavender / nude / editorial
geometry.

The supplied LIHEN promotional coupon reference is the visual authority for
hierarchy and rhythm, without copying its commercial values or unsupported
conditions.

## Reference-aligned single-source rendering

Manual review demonstrated that maintaining an independent HTML composition
and Canvas composition allowed the two outputs to drift.

The customer-facing browser preview now displays the exact PNG produced by the
same reference-aligned Canvas renderer used by download/share.

This intentionally makes:

PREVIEW == PNG

for the customer-facing creative.

The operator-facing Creative QA and sharing controls remain normal Control
Center UI and are not embedded inside the customer creative.

The approved visual hierarchy is:

1. official LIHEN brand header;
2. emotional script headline;
3. short introduction;
4. dedicated discount-ticket block;
5. prominent exclusive-code panel;
6. validity / benefit-status panel;
7. emotional closing;
8. LIHEN footer.

Beauty Care preserves the approved blush / cream direction.

Style preserves the approved lavender / nude direction.

The official logo source remains unchanged. Its accidental opaque background
continues to be neutralized only at presentation time.

## Operator share panel refinement

The customer-facing coupon remains visually frozen after approval.

Only the operator-facing share panel was refined.

The panel is now divided into four clear zones:

1. Creative QA / brand governance;
2. three-step customer sharing workflow;
3. suggested-message workspace;
4. explicit user-controlled actions.

The underlying governance values remain unchanged:

- Brand check = PASS;
- Logo integrity = PASS;
- Execution = PREPARED_ONLY.

The user-facing label may render `PREPARED ONLY` for readability while the
underlying state remains `PREPARED_ONLY`.

WhatsApp remains user-controlled. The action continues to open WhatsApp rather
than sending a message automatically.

No Customer Benefit lifecycle, Supabase persistence, RPC, Canvas creative,
customer-facing PNG, scheduler, social execution, or production behavior was
changed by this UI refinement.

## Operator share panel refinement

The customer-facing coupon remains visually frozen after approval.

Only the operator-facing share panel was refined.

The panel is now divided into four clear zones:

1. Creative QA / brand governance;
2. three-step customer sharing workflow;
3. suggested-message workspace;
4. explicit user-controlled actions.

The underlying governance values remain unchanged:

- Brand check = PASS;
- Logo integrity = PASS;
- Execution = PREPARED_ONLY.

The user-facing label may render `PREPARED ONLY` for readability while the
underlying state remains `PREPARED_ONLY`.

WhatsApp remains user-controlled. The action continues to open WhatsApp rather
than sending a message automatically.

No Customer Benefit lifecycle, Supabase persistence, RPC, Canvas creative,
customer-facing PNG, scheduler, social execution, or production behavior was
changed by this UI refinement.
