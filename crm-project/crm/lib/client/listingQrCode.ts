import QRCode from 'qrcode';

export type ListingQrAssignment = {
  id: string;
  qr_code_id: string;
  code_number: number;
  public_token: string;
  public_url: string;
  flyer_url: string;
  destination_url:
    | string
    | null;
  destination_mode: string;
  assigned_at: string;
  status:
    | 'assigned'
    | 'disabled';
};

export async function listingQrCodeDataUrl(
  value: string,
  width = 1024
) {
  const normalizedValue =
    String(
      value || ''
    ).trim();

  if (
    !/^https:\/\/[^\s]+$/i.test(
      normalizedValue
    )
  ) {
    throw new Error(
      'The listing QR destination must be a valid HTTPS URL.'
    );
  }

  const normalizedWidth =
    Math.min(
      2048,
      Math.max(
        256,
        Math.round(
          Number(width) ||
          1024
        )
      )
    );

  return QRCode.toDataURL(
    normalizedValue,
    {
      type:
        'image/png',

      errorCorrectionLevel:
        'H',

      margin:
        4,

      width:
        normalizedWidth,

      color: {
        dark:
          '#000000',

        light:
          '#ffffff',
      },
    }
  );
}
