'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User {
  id: number;
  name: string;
  bio: string;
  picture_url: string;
}

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch('/api/public/users')
      .then(res => res.json())
      .then(data => setUsers(data));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Meet Our Team</h1>
      <div className="grid md:grid-cols-3 gap-6">
        {users.map(user => (
          <div key={user.id} className="bg-white rounded-lg shadow-md p-4 text-center">
            <img
              src={user.picture_url || '/default-avatar.png'}
              alt={user.name}
              className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
            />
            <h2 className="text-xl font-semibold">{user.name}</h2>
            <p className="text-gray-600 text-sm">{user.bio?.slice(0, 80)}...</p>
            <Link href={`/team/${user.id}`} className="text-blue-500 mt-3 inline-block">
              View Profile →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
