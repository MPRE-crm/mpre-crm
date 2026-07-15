'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Mail,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

const supabase = getSupabaseBrowser();

type Role = 'agent' | 'admin' | 'org_admin' | 'platform_admin';

type Profile = {
  id: string;
  email: string | null;
  role: Role;
  org_id: string | null;
  marketing_from_name: string | null;
  marketing_from_email: string | null;
  marketing_reply_to_email: string | null;
  marketing_physical_address: string | null;
  marketing_email_enabled: boolean;
};

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  contact_type: string;
  lifecycle_stage: string;
  email_marketing_status: string;
  do_not_contact: boolean;
  created_at: string;
};

type Listing = {
  id: string;
  title: string;
  property_address: string;
  city: string | null;
  state: string | null;
  mls_number: string | null;
  list_price: number | null;
  listing_status: string;
  created_at: string;
};

type CampaignStat = {
  campaign_id: string;
  name: string;
  subject: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  unique_open_count: number;
  unique_click_count: number;
  bounced_count: number;
  complained_count: number;
  unsubscribed_count: number;
  open_rate: number | string;
  click_rate: number | string;
};

function formatDate(value?: string | null) {
  if (!value) return '-';

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return '-';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRate(value?: number | string | null) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed)) return '0%';

  return `${parsed.toFixed(1)}%`;
}

function displayContactName(contact: Contact) {
  return (
    contact.display_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
    contact.email ||
    'Unnamed contact'
  );
}

export default function EmailMarketingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const { data: userResult, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userResult?.user) {
        throw new Error(userError?.message || 'Not authenticated.');
      }

      const userId = userResult.user.id;

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          role,
          org_id,
          marketing_from_name,
          marketing_from_email,
          marketing_reply_to_email,
          marketing_physical_address,
          marketing_email_enabled
        `)
        .eq('id', userId)
        .single();

      if (profileError || !profileRow) {
        throw new Error(profileError?.message || 'Profile not found.');
      }

      setProfile(profileRow as Profile);

      const [
        contactsResult,
        listingsResult,
        campaignsResult,
      ] = await Promise.all([
        supabase
          .from('contacts')
          .select(`
            id,
            first_name,
            last_name,
            display_name,
            company,
            email,
            phone,
            contact_type,
            lifecycle_stage,
            email_marketing_status,
            do_not_contact,
            created_at
          `)
          .order('created_at', { ascending: false })
          .limit(5000),

        supabase
          .from('listings')
          .select(`
            id,
            title,
            property_address,
            city,
            state,
            mls_number,
            list_price,
            listing_status,
            created_at
          `)
          .order('created_at', { ascending: false })
          .limit(500),

        supabase
          .from('email_campaign_stats')
          .select(`
            campaign_id,
            name,
            subject,
            status,
            created_at,
            sent_at,
            total_recipients,
            sent_count,
            delivered_count,
            unique_open_count,
            unique_click_count,
            bounced_count,
            complained_count,
            unsubscribed_count,
            open_rate,
            click_rate
          `)
          .order('created_at', { ascending: false })
          .limit(250),
      ]);

      if (contactsResult.error) {
        throw new Error(contactsResult.error.message);
      }

      if (listingsResult.error) {
        throw new Error(listingsResult.error.message);
      }

      if (campaignsResult.error) {
        throw new Error(campaignsResult.error.message);
      }

      setContacts((contactsResult.data || []) as Contact[]);
      setListings((listingsResult.data || []) as Listing[]);
      setCampaigns((campaignsResult.data || []) as CampaignStat[]);
    } catch (err: any) {
      setError(err?.message || 'Could not load email marketing data.');
      setContacts([]);
      setListings([]);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const activeContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.email &&
          contact.email_marketing_status === 'active' &&
          contact.do_not_contact !== true
      ),
    [contacts]
  );

  const realtorContacts = useMemo(
    () =>
      activeContacts.filter(
        (contact) => contact.contact_type === 'realtor'
      ),
    [activeContacts]
  );

  const activeListings = useMemo(
    () =>
      listings.filter((listing) =>
        ['coming_soon', 'active', 'pending'].includes(
          listing.listing_status
        )
      ),
    [listings]
  );

  const totals = useMemo(() => {
    return campaigns.reduce(
      (current, campaign) => ({
        recipients:
          current.recipients + Number(campaign.total_recipients || 0),

        delivered:
          current.delivered + Number(campaign.delivered_count || 0),

        opens:
          current.opens + Number(campaign.unique_open_count || 0),

        clicks:
          current.clicks + Number(campaign.unique_click_count || 0),
      }),
      {
        recipients: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
      }
    );
  }, [campaigns]);

  if (loading) {
    return (
      <div className="text-sm text-slate-500">
        Loading email marketing...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <Mail className="h-3.5 w-3.5" />
              CRM Email Marketing
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Contacts, Listings and Email Campaigns
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              This first stage verifies the marketing database, organization
              permissions and campaign reporting before email sending is
              activated.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/dashboard/email-marketing/contacts"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Users className="h-4 w-4" />
              Manage Contacts
            </a>

            <a
              href="/dashboard/email-marketing/listings"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
            >
              <Building2 className="h-4 w-4" />
              Manage Listings
            </a>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {!profile?.marketing_physical_address && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your commercial-email mailing address has not been entered yet.
          Sending will remain blocked until a real business mailing address is
          saved.
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Users className="h-4 w-4 text-blue-600" />
            Contacts
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {contacts.length}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {activeContacts.length} eligible for email
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Users className="h-4 w-4 text-emerald-600" />
            Realtors
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {realtorContacts.length}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Active Realtor email contacts
          </div>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Building2 className="h-4 w-4 text-orange-600" />
            Listings
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {listings.length}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {activeListings.length} currently active
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Send className="h-4 w-4 text-violet-600" />
            Campaigns
          </div>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {campaigns.length}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {totals.recipients} total recipients
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Sender Identity
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            These values are loaded from your CRM profile.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sender Name
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {profile?.marketing_from_name || '-'}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sender Email
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {profile?.marketing_from_email || '-'}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reply-To
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {profile?.marketing_reply_to_email || '-'}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sending Enabled
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {profile?.marketing_email_enabled ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Contacts
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Lifecycle</th>
                <th className="px-4 py-3">Email Status</th>
              </tr>
            </thead>

            <tbody>
              {contacts.slice(0, 25).map((contact) => (
                <tr key={contact.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    {displayContactName(contact)}
                  </td>
                  <td className="px-4 py-3">
                    {contact.company || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {contact.email || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {contact.contact_type}
                  </td>
                  <td className="px-4 py-3">
                    {contact.lifecycle_stage}
                  </td>
                  <td className="px-4 py-3">
                    {contact.email_marketing_status}
                  </td>
                </tr>
              ))}

              {contacts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No contacts have been imported yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Current Listings
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">MLS</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {listing.title}
                  </td>
                  <td className="px-4 py-3">
                    {listing.property_address}
                    {listing.city ? `, ${listing.city}` : ''}
                    {listing.state ? `, ${listing.state}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    {listing.mls_number || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {formatPrice(listing.list_price)}
                  </td>
                  <td className="px-4 py-3">
                    {listing.listing_status}
                  </td>
                </tr>
              ))}

              {listings.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No marketing listings have been added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Campaign Results
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Recipients</th>
                <th className="px-4 py-3">Delivered</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3">Open Rate</th>
                <th className="px-4 py-3">Clicked</th>
                <th className="px-4 py-3">Click Rate</th>
                <th className="px-4 py-3">Sent</th>
              </tr>
            </thead>

            <tbody>
              {campaigns.map((campaign) => (
                <tr
                  key={campaign.campaign_id}
                  className="border-t border-slate-100"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {campaign.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {campaign.subject}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {campaign.status}
                  </td>

                  <td className="px-4 py-3">
                    {campaign.total_recipients}
                  </td>

                  <td className="px-4 py-3">
                    {campaign.delivered_count}
                  </td>

                  <td className="px-4 py-3">
                    {campaign.unique_open_count}
                  </td>

                  <td className="px-4 py-3">
                    {formatRate(campaign.open_rate)}
                  </td>

                  <td className="px-4 py-3">
                    {campaign.unique_click_count}
                  </td>

                  <td className="px-4 py-3">
                    {formatRate(campaign.click_rate)}
                  </td>

                  <td className="px-4 py-3">
                    {formatDate(campaign.sent_at)}
                  </td>
                </tr>
              ))}

              {campaigns.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No email campaigns have been created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


