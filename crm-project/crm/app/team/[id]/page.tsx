'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  bio: string;
  picture_url: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  relocation_guide_url: string;
}

export default function TeamMemberPage() {
  const params = useParams();
  const id = params?.id as string; // ✅ Fix type error by explicitly casting

  const [member, setMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchMember = async () => {
      try {
        const res = await fetch(`/api/public/users/${id}`);
        if (!res.ok) throw new Error('Failed to fetch team member');
        const data = await res.json();
        setMember(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMember();
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (!member) return <p>Team member not found</p>;

  return (
    <div>
      <h1>{member.name}</h1>
      {member.picture_url && <img src={member.picture_url} alt={member.name} width={200} />}
      <p>{member.bio}</p>
      <p>Email: {member.email}</p>
      <p>Phone: {member.phone}</p>
      <p>
        {member.facebook && <a href={member.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}
        {member.instagram && <> | <a href={member.instagram} target="_blank" rel="noopener noreferrer">Instagram</a></>}
        {member.linkedin && <> | <a href={member.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a></>}
      </p>
      {member.relocation_guide_url && (
        <p>
          <a href={member.relocation_guide_url} target="_blank" rel="noopener noreferrer">
            View Relocation Guide
          </a>
        </p>
      )}
    </div>
  );
}
