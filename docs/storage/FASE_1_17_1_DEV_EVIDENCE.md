# FASE 1.17.1 — DEV Evidence

Project: `lihen-platform-dev`
Project ref: `vnmkupzptujtywnnabkp`
Date: 2026-08-21

## Remote provisioning result

`lihen-product-originals`
- public: false
- file_size_limit: 12,582,912 bytes (12 MiB)
- allowed MIME: image/jpeg, image/png, image/webp

`lihen-product-web`
- public: true
- file_size_limit: 3,145,728 bytes (3 MiB)
- allowed MIME: image/jpeg, image/png, image/webp

## Closed gates after provisioning

- originals objects: 0
- web objects: 0
- LIHEN product-image Storage policies: 0
- `VITE_PRODUCT_IMAGE_WRITE_MODE=blocked`
- `VITE_PRODUCT_IMAGE_STORAGE_UPLOAD_MODE=blocked`

No upload, update or delete path was enabled.

## Security Advisor

No new Storage/database finding was introduced. The pre-existing Auth warning `auth_leaked_password_protection` remains unrelated to this phase.
