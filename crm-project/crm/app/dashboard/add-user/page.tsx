'use client';

import { useState } from 'react';

export default function AddUserPage() {
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    facebook_url: '', instagram_url: '', youtube_url: '', linkedin_url: '',
    bio: '', relocation_guide_url: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [userIdForPic, setUserIdForPic] = useState('temp'); // optional placeholder until you have auth user id

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    let profile_picture_url = '';
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('user_id', userIdForPic);
      const up = await fetch('/api/storage/profile-picture/upload', { method: 'POST', body: fd });
      const upJson = await up.json();
      if (!upJson.ok) return alert(`Upload failed: ${upJson.error}`);
      profile_picture_url = upJson.url;
    }

    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, profile_picture_url })
    });

    const json = await res.json();
    if (!json.ok) return alert(`Create failed: ${json.error}`);

    alert('User created!');
    setForm({
      name: '', phone: '', email: '',
      facebook_url: '', instagram_url: '', youtube_url: '', linkedin_url: '',
      bio: '', relocation_guide_url: ''
    });
    setFile(null);
  }

  return (
    <div className="max-w-2xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Add Team Member</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input name="name" placeholder="Name" className="w-full border p-2" value={form.name} onChange={onChange} required />
        <input name="phone" placeholder="Phone" className="w-full border p-2" value={form.phone} onChange={onChange} />
        <input name="email" placeholder="Email" className="w-full border p-2" value={form.email} onChange={onChange} required />
        <div className="grid grid-cols-2 gap-3">
          <input name="facebook_url" placeholder="Facebook URL" className="border p-2" value={form.facebook_url} onChange={onChange} />
          <input name="instagram_url" placeholder="Instagram URL" className="border p-2" value={form.instagram_url} onChange={onChange} />
          <input name="youtube_url" placeholder="YouTube URL" className="border p-2" value={form.youtube_url} onChange={onChange} />
          <input name="linkedin_url" placeholder="LinkedIn URL" className="border p-2" value={form.linkedin_url} onChange={onChange} />
        </div>
        <textarea name="bio" placeholder="Short bio" className="w-full border p-2 min-h-[120px]" value={form.bio} onChange={onChange} />
        <input name="relocation_guide_url" placeholder="Relocation Guide URL (optional)" className="w-full border p-2" value={form.relocation_guide_url} onChange={onChange} />
        <div className="space-y-2">
          <label className="block font-medium">Profile Picture (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <button type="submit" className="px-4 py-2 bg-black text-white rounded">Create User</button>
      </form>
    </div>
  );
}
