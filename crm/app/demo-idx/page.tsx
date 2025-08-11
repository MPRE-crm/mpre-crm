'use client';

import Image from 'next/image';

export default function DemoIDXPage() {
  const sampleListings = [
    {
      id: 1,
      title: 'Modern Boise Home',
      price: '$625,000',
      image: '/sample-home-1.jpg',
      beds: 3,
      baths: 2,
      sqft: 2100,
    },
    {
      id: 2,
      title: 'Eagle Family Retreat',
      price: '$749,000',
      image: '/sample-home-2.jpg',
      beds: 4,
      baths: 3,
      sqft: 2800,
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <h1>Demo IDX Listings</h1>
      <p>This is a sample IDX feed using static listings. A live feed would update this dynamically from the MLS.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 20 }}>
        {sampleListings.map((listing) => (
          <div key={listing.id} style={{ border: '1px solid #ccc', borderRadius: 8, width: 300 }}>
            <Image
              src={listing.image}
              alt={listing.title}
              width={300}
              height={200}
              style={{ borderTopLeftRadius: 8, borderTopRightRadius: 8, objectFit: 'cover' }}
            />
            <div style={{ padding: 10 }}>
              <h2>{listing.title}</h2>
              <p><strong>{listing.price}</strong></p>
              <p>{listing.beds} beds • {listing.baths} baths • {listing.sqft} sqft</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
