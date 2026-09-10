import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import lihenLogoOfficial from '../assets/brand/lihen-logo-official.png';
import { resolveBeautyBrandCoverAudit, computeBeautyBrandWordmarkFit } from '../composition/catalog-beauty-brand-cover-intelligence';

type FrameSize = {
  width: number;
  height: number;
};

function useDetectedBrandFrame() {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState<FrameSize>({ width: 1, height: 1 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    update();

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(update)
        : null;

    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);

  return { ref, size };
}

export function CatalogBeautyBrandLogo({ brand }: { brand: string }) {
  const audit = resolveBeautyBrandCoverAudit(brand);
  const { ref, size } = useDetectedBrandFrame();

  const wordmarkFit = useMemo(
    () =>
      computeBeautyBrandWordmarkFit({
        frameWidth: size.width,
        frameHeight: size.height,
        name: audit?.canonicalBrand ?? brand,
        preferredLines: audit?.preferredLines ?? 1,
        targetOccupancy: audit?.targetOccupancy ?? 0.88,
      }),
    [
      audit?.canonicalBrand,
      audit?.preferredLines,
      audit?.targetOccupancy,
      brand,
      size.height,
      size.width,
    ],
  );

  if (brand === 'LIHEN') {
    return (
      <figure
        ref={ref}
        className="catalog-brand-presentation catalog-brand-presentation--official"
        data-brand-cover-audit="OFFICIAL_LIHEN"
      >
        <img
          className="catalog-brand-presentation__asset"
          src={lihenLogoOfficial}
          alt="Logo oficial LIHEN.CO"
        />
      </figure>
    );
  }

  if (audit?.finalMode === 'VERIFIED_ASSET' && audit.selectedAssetUrl) {
    return (
      <figure
        ref={ref}
        className="catalog-brand-presentation"
        data-brand-cover-audit="VERIFIED_ASSET"
        data-brand-review="false"
      >
        <img
          className="catalog-brand-presentation__asset"
          src={audit.selectedAssetUrl}
          alt={`Marca ${audit.canonicalBrand}`}
          loading="eager"
        />
      </figure>
    );
  }

  const name = audit?.canonicalBrand ?? brand;
  const review = audit?.finalMode === 'REVIEW_WORDMARK';

  return (
    <section
      ref={ref}
      className="catalog-brand-presentation catalog-brand-presentation--wordmark"
      data-brand-cover-audit={review ? 'REVIEW_WORDMARK' : 'VERIFIED_WORDMARK'}
      data-brand-review={review ? 'true' : 'false'}
      title={
        review
          ? 'Identidad de marca pendiente de validación visual'
          : 'Wordmark editorial basado en identidad canónica verificada'
      }
    >
      <div
        className="catalog-brand-wordmark catalog-brand-wordmark--auto-fit"
        style={{
          fontSize: `${wordmarkFit.fontSize}px`,
          lineHeight: wordmarkFit.lineHeight,
          maxWidth: `${wordmarkFit.maxWidth}px`,
          maxHeight: `${wordmarkFit.maxHeight}px`,
        }}
      >
        <span>{name}</span>
      </div>
    </section>
  );
}
