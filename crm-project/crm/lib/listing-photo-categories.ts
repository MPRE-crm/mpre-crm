export const LISTING_PHOTO_CATEGORIES = [
  'front_exterior',
  'exterior',
  'kitchen',
  'living_room',
  'dining_room',
  'primary_bedroom',
  'bedroom',
  'primary_bathroom',
  'bathroom',
  'office',
  'bonus_room',
  'hallway',
  'foyer',
  'laundry',
  'garage',
  'shop',
  'backyard',
  'patio',
  'view',
  'pool',
  'community',
  'detail',
  'floor_plan',
  'other',
] as const;

export type ListingPhotoCategory =
  typeof LISTING_PHOTO_CATEGORIES[number];

export const LISTING_PHOTO_CATEGORY_LABELS:
  Record<
    ListingPhotoCategory,
    string
  > = {
  front_exterior:
    'Front Exterior',

  exterior:
    'Exterior',

  kitchen:
    'Kitchen',

  living_room:
    'Living Room',

  dining_room:
    'Dining Room',

  primary_bedroom:
    'Primary Bedroom',

  bedroom:
    'Bedroom',

  primary_bathroom:
    'Primary Bathroom',

  bathroom:
    'Bathroom',

  office:
    'Office',

  bonus_room:
    'Bonus Room',

  hallway:
    'Hallway',

  foyer:
    'Foyer',

  laundry:
    'Laundry Room',

  garage:
    'Garage',

  shop:
    'Shop',

  backyard:
    'Backyard',

  patio:
    'Patio',

  view:
    'View',

  pool:
    'Pool',

  community:
    'Community',

  detail:
    'Detail',

  floor_plan:
    'Floor Plan',

  other:
    'Other',
};

const LISTING_PHOTO_CATEGORY_SET =
  new Set<string>(
    LISTING_PHOTO_CATEGORIES
  );

export function isListingPhotoCategory(
  value: unknown
): value is ListingPhotoCategory {
  return (
    typeof value ===
      'string' &&
    LISTING_PHOTO_CATEGORY_SET.has(
      value
    )
  );
}

export function listingPhotoCategoryLabel(
  category:
    ListingPhotoCategory
) {
  return LISTING_PHOTO_CATEGORY_LABELS[
    category
  ];
}