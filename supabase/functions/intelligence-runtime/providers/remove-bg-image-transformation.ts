export interface RemoveBgTransformationInput {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export interface RemoveBgTransformationOutput {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export interface RemoveBgTransformationProvider {
  removeBackground(
    input: RemoveBgTransformationInput,
  ): Promise<RemoveBgTransformationOutput>;
}

function sourceExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error(
        `REMOVE_BG_SOURCE_MIME_NOT_ALLOWED:${mimeType}`,
      );
  }
}

export function createRemoveBgTransformationProvider(): RemoveBgTransformationProvider {
  return {
    async removeBackground(input) {
      const apiKey = Deno.env.get('REMOVE_BG_API_KEY');

      if (!apiKey) {
        throw new Error('REMOVE_BG_API_KEY_NOT_CONFIGURED');
      }

      if (input.bytes.byteLength === 0) {
        throw new Error('REMOVE_BG_SOURCE_EMPTY');
      }

      const extension = sourceExtension(input.mimeType);

      const form = new FormData();

      form.set(
        'image_file',
        new Blob(
          [input.bytes],
          { type: input.mimeType },
        ),
        `lihen-source.${extension}`,
      );

      form.set('size', 'auto');

      const response = await fetch(
        'https://api.remove.bg/v1.0/removebg',
        {
          method: 'POST',
          headers: {
            'X-Api-Key': apiKey,
          },
          body: form,
        },
      );

      if (!response.ok) {
        const detail =
          await response.text().catch(() => '');

        throw new Error(
          `REMOVE_BG_PROVIDER_FAILED:${response.status}:${detail.slice(0, 300)}`,
        );
      }

      const mimeType =
        response.headers
          .get('content-type')
          ?.split(';')[0]
          ?.trim()
        || 'image/png';

      const bytes = new Uint8Array(
        await response.arrayBuffer(),
      );

      if (bytes.byteLength === 0) {
        throw new Error('REMOVE_BG_PROVIDER_EMPTY_RESULT');
      }

      return {
        bytes,
        mimeType,
      };
    },
  };
}
