export type WebImageDerivativeTransform = Readonly<{
  version: 'WEBP_Q85_METHOD6_NO_UPSCALE_V1';
  format: 'webp';
  mimeType: 'image/webp';
  width: 345;
  height: 176;
  quality: 85;
  encoderMethod: 6;
  metadataStripped: true;
  upscaled: false;
}>;

export type WebImageDerivativeUploadCandidate = Readonly<{
  sourceReferenceId: string;
  productId: string;
  productImageId: string;
  approvalSource: 'HUMAN_APPROVED' | 'POLICY_APPROVED';
  derivativeSha256: string;
  derivativeSizeBytes: number;
  bucket: 'lihen-product-web';
  storagePath: string;
  localPath: string;
  status: 'DRY_RUN_READY';
}>;

export const WEB_IMAGE_TRANSFORM_V1: WebImageDerivativeTransform = {
  version: 'WEBP_Q85_METHOD6_NO_UPSCALE_V1',
  format: 'webp',
  mimeType: 'image/webp',
  width: 345,
  height: 176,
  quality: 85,
  encoderMethod: 6,
  metadataStripped: true,
  upscaled: false,
};
