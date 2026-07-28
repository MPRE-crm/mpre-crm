'use client';

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  RefreshCw,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import { getSupabaseBrowser } from '../../../../lib/supabase-browser';
import ContactEnrichmentReviewPanel from './ContactEnrichmentReviewPanel';

const supabase = getSupabaseBrowser();

type Role = 'agent' | 'admin' | 'org_admin' | 'platform_admin';

type Profile = {
  id: string;
  email: string | null;
  role: Role;
  org_id: string | null;
};

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  company: string | null;
  company_normalized: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  mls_agent_id: string | null;
  mls_office_id: string | null;
  license_number: string | null;
  contact_review_status: string;
  contact_type: string;
  lifecycle_stage: string;
  relationship_status: string | null;
  prospect_temperature: string | null;
  is_archived: boolean;
  tags: string[];
  email_marketing_status: string;
  do_not_contact: boolean;
  created_at: string;
};

type Mapping = {
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  mls_agent_id: string;
  mls_office_id: string;
  license_number: string;
};

const CONTACT_TYPES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'buyer_seller', label: 'Buyer & Seller' },
  {
    value: 'past_client',
    label: 'Past or Closed Client',
  },
  { value: 'sphere', label: 'Sphere of Influence' },
  { value: 'realtor', label: 'Realtor' },
  { value: 'lender', label: 'Lender' },
  {
    value: 'title_escrow',
    label: 'Title / Escrow',
  },
  {
    value: 'vendor_partner',
    label: 'Vendor or Partner',
  },
  { value: 'professional', label: 'Professional' },
  {
    value: 'other',
    label: 'Other / General Contact',
  },
];

const PROSPECT_TEMPERATURES = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];

const RELATIONSHIP_STATUSES = [
  { value: 'active', label: 'Active' },
  {
    value: 'under_contract',
    label: 'Under Contract',
  },
  { value: 'lost', label: 'Lost' },
];

function usesRelationshipStatus(
  contactType: string
): boolean {
  return [
    'buyer',
    'seller',
    'buyer_seller',
  ].includes(contactType);
}

function legacyLifecycleForCategory(
  contactType: string,
  relationshipStatus: string | null = null
): string {
  if (relationshipStatus === 'under_contract') {
    return 'under_contract';
  }

  if (relationshipStatus === 'lost') {
    return 'lost';
  }

  switch (contactType) {
    case 'buyer':
    case 'buyer_seller':
      return 'active_buyer';

    case 'seller':
      return 'active_seller';

    case 'past_client':
      return 'past_client';

    case 'sphere':
      return 'sphere';

    default:
      return 'prospect';
  }
}

const EMAIL_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'complained', label: 'Complained' },
  { value: 'suppressed', label: 'Suppressed' },
];

const EMPTY_MAPPING: Mapping = {
  first_name: '',
  last_name: '',
  display_name: '',
  email: '',
  phone: '',
  company: '',
  job_title: '',
  mls_agent_id: '',
  mls_office_id: '',
  license_number: '',
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function parseDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current.trim());

  return values;
}

function parseDelimitedText(value: string) {
  const clean = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!clean) {
    return {
      delimiter: '\t',
      headers: [] as string[],
      rows: [] as string[][],
    };
  }

  const lines = clean
    .split('\n')
    .filter((line) => line.trim().length > 0);

  const delimiter =
    lines[0]?.includes('\t')
      ? '\t'
      : ',';

  const parsed = lines.map((line) =>
    parseDelimitedLine(line, delimiter)
  );

  return {
    delimiter,
    headers: parsed[0] || [],
    rows: parsed.slice(1),
  };
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const exact = normalizedHeaders.indexOf(normalizedAlias);

    if (exact >= 0) {
      return String(exact);
    }
  }

  for (let index = 0; index < normalizedHeaders.length; index += 1) {
    const header = normalizedHeaders[index];

    if (
      aliases.some((alias) =>
        header.includes(normalizeHeader(alias))
      )
    ) {
      return String(index);
    }
  }

  return '';
}

function detectMapping(headers: string[]): Mapping {
  return {
    first_name: findHeaderIndex(headers, [
      'first name',
      'firstname',
      'first',
    ]),

    last_name: findHeaderIndex(headers, [
      'last name',
      'lastname',
      'last',
      'surname',
    ]),

    display_name: findHeaderIndex(headers, [
      'display name',
      'full name',
      'name',
    ]),

    email: findHeaderIndex(headers, [
      'email',
      'email address',
      'e-mail',
    ]),

    phone: findHeaderIndex(headers, [
      'phone',
      'phone number',
      'mobile',
      'cell',
      'telephone',
    ]),

    company: findHeaderIndex(headers, [
      'company',
      'brokerage',
      'office name',
      'organization',
    ]),

    job_title: findHeaderIndex(headers, [
      'job title',
      'title',
      'position',
      'role',
    ]),

    mls_agent_id: findHeaderIndex(headers, [
      'mls agent id',
      'agent mls id',
      'mls user code',
      'user code',
      'member mls id',
      'external agent id',
    ]),

    mls_office_id: findHeaderIndex(headers, [
      'mls office id',
      'office mls id',
      'office code',
      'external office id',
    ]),

    license_number: findHeaderIndex(headers, [
      'license number',
      'license',
      'agent license',
      'realtor license',
    ]),
  };
}

function mappedValue(
  row: string[],
  column: string
) {
  if (column === '') return '';

  const index = Number(column);

  if (!Number.isInteger(index)) return '';

  return String(row[index] || '').trim();
}

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

function looksLikeEmail(value: string) {
  return (
    value.includes('@') &&
    value.includes('.') &&
    !value.includes(' ')
  );
}

function displayName(contact: Contact) {
  return (
    contact.display_name ||
    [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    contact.email ||
    'Unnamed contact'
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function reviewStatusLabel(value: string) {
  if (value === 'needs_review') {
    return 'Directory Pending';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function reviewStatusClasses(value: string) {
  if (value === 'ready') {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (value === 'needs_review') {
    return 'bg-amber-50 text-amber-700';
  }

  return 'bg-slate-100 text-slate-600';
}

export default function MarketingContactsPage() {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [savingContactId, setSavingContactId] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [mapping, setMapping] =
    useState<Mapping>(EMPTY_MAPPING);

  const [defaultCompany, setDefaultCompany] =
    useState('');

  const [defaultContactType, setDefaultContactType] =
    useState('realtor');

  const [
    defaultProspectTemperature,
    setDefaultProspectTemperature,
  ] = useState('hot');

  const [
    defaultRelationshipStatus,
    setDefaultRelationshipStatus,
  ] = useState('active');

  const [search, setSearch] = useState('');
  const [brokerageFilter, setBrokerageFilter] =
    useState('all');
  const [reviewFilter, setReviewFilter] =
    useState('all');

  const parsed = useMemo(
    () => parseDelimitedText(rawText),
    [rawText]
  );

  useEffect(() => {
    setMapping(detectMapping(parsed.headers));
  }, [parsed.headers.join('|')]);

  async function loadContacts() {
    try {
      setLoading(true);
      setError(null);

      const { data: userResult, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userResult?.user) {
        throw new Error(
          userError?.message || 'Not authenticated.'
        );
      }

      const userId = userResult.user.id;

      const { data: profileRow, error: profileError } =
        await supabase
          .from('profiles')
          .select('id, email, role, org_id')
          .eq('id', userId)
          .single();

      if (profileError || !profileRow) {
        throw new Error(
          profileError?.message || 'Profile not found.'
        );
      }

      const typedProfile = profileRow as Profile;

      if (!typedProfile.org_id) {
        throw new Error(
          'Your profile does not have an organization.'
        );
      }

      setProfile(typedProfile);

      const { data, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id,
          first_name,
          last_name,
          display_name,
          company,
          company_normalized,
          job_title,
          email,
          phone,
          mls_agent_id,
          mls_office_id,
          license_number,
          contact_review_status,
          contact_type,
          lifecycle_stage,
          relationship_status,
          prospect_temperature,
          is_archived,
          tags,
          email_marketing_status,
          do_not_contact,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (contactsError) {
        throw new Error(contactsError.message);
      }

      setContacts((data || []) as Contact[]);
    } catch (err: any) {
      setError(
        err?.message || 'Could not load contacts.'
      );
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  async function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();

      setFileName(file.name);
      setRawText(text);
      setError(null);
      setNotice(null);
    } catch (err: any) {
      setError(
        err?.message || 'Could not read the contact file.'
      );
    }
  }

  async function importContacts() {
    if (!profile?.org_id) {
      setError('Your CRM profile is missing an organization.');
      return;
    }

    if (!mapping.email) {
      setError('Choose the column containing email addresses.');
      return;
    }

    if (parsed.rows.length === 0) {
      setError('No contact rows were found.');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setNotice(null);

      const uniqueRows = new Map<
        string,
        Record<string, any>
      >();

      let invalidEmailCount = 0;

      for (const row of parsed.rows) {
        const email = cleanEmail(
          mappedValue(row, mapping.email)
        );

        if (!looksLikeEmail(email)) {
          invalidEmailCount += 1;
          continue;
        }

        const firstName = mappedValue(
          row,
          mapping.first_name
        );

        const lastName = mappedValue(
          row,
          mapping.last_name
        );

        const mappedDisplayName = mappedValue(
          row,
          mapping.display_name
        );

        const generatedDisplayName =
          mappedDisplayName ||
          [firstName, lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          email;

        const mappedCompany = mappedValue(
          row,
          mapping.company
        );

        uniqueRows.set(email, {
          org_id: profile.org_id,
          owner_user_id: profile.id,
          created_by: profile.id,

          first_name: firstName || null,
          last_name: lastName || null,
          display_name: generatedDisplayName,

          company:
            mappedCompany ||
            defaultCompany.trim() ||
            null,

          job_title:
            mappedValue(row, mapping.job_title) ||
            null,

          email,

          phone:
            mappedValue(row, mapping.phone) ||
            null,

          mls_agent_id:
            mappedValue(row, mapping.mls_agent_id) ||
            null,

          mls_office_id:
            mappedValue(row, mapping.mls_office_id) ||
            null,

          license_number:
            mappedValue(row, mapping.license_number) ||
            null,

          contact_type: defaultContactType,

          lifecycle_stage:
            legacyLifecycleForCategory(
              defaultContactType,
              defaultRelationshipStatus
            ),

          relationship_status:
            usesRelationshipStatus(defaultContactType)
              ? defaultRelationshipStatus
              : null,

          prospect_temperature:
            defaultContactType === 'prospect'
              ? defaultProspectTemperature
              : null,

          is_archived: false,

          tags: [
            'Listing advertisements',
          ],

          email_marketing_status: 'active',
          sms_marketing_status: 'not_consented',
          do_not_contact: false,

          source:
            fileName
              ? `Contact import: ${fileName}`
              : 'Contact import: pasted data',
        });
      }

      const payload = Array.from(uniqueRows.values());

      if (payload.length === 0) {
        throw new Error(
          'No valid email contacts were found.'
        );
      }

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      const accessToken =
        sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error(
          'Your login session could not be verified. Refresh the page and try again.'
        );
      }

      const response = await fetch(
        '/api/marketing/contact-import',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            rows: payload,
            file_name: fileName || null,
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
          'Contact import failed.'
        );
      }

      await loadContacts();

      const totalInvalidRows =
        invalidEmailCount +
        Number(result.invalid_rows || 0);

      setNotice(
        [
          `${Number(result.new_contacts || 0)} new contacts imported.`,
          `${Number(result.enriched_contacts || 0)} existing contacts safely enriched.`,
          `${Number(result.existing_unchanged || 0)} existing contacts already current.`,
          `${Number(result.conflicts_found || 0)} conflicts found.`,
          `${Number(result.reviews_queued || 0)} review items queued.`,
          `${Number(result.access_skipped || 0)} contacts outside your ownership skipped.`,
          `${totalInvalidRows} rows without valid emails skipped.`,
        ].join(' ')
      );
    } catch (err: any) {
      setError(
        err?.message || 'Contact import failed.'
      );
    } finally {
      setImporting(false);
    }
  }

  async function updateContact(
    contactId: string,
    patch: Partial<Contact>
  ) {
    try {
      setSavingContactId(contactId);
      setError(null);
      setNotice(null);

      const { error: updateError } = await supabase
        .from('contacts')
        .update(patch)
        .eq('id', contactId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setContacts((current) =>
        current.map((contact) =>
          contact.id === contactId
            ? {
                ...contact,
                ...patch,
              }
            : contact
        )
      );
    } catch (err: any) {
      setError(
        err?.message || 'Could not update contact.'
      );
    } finally {
      setSavingContactId(null);
    }
  }

  const brokerageOptions = useMemo(
    () =>
      Array.from(
        new Set(
          contacts
            .map((contact) => contact.company?.trim())
            .filter(
              (company): company is string =>
                Boolean(company)
            )
        )
      ).sort((first, second) =>
        first.localeCompare(second)
      ),
    [contacts]
  );

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return contacts.filter((contact) => {
      const brokerageMatches =
        brokerageFilter === 'all'
          ? true
          : brokerageFilter === 'unknown'
            ? !contact.company?.trim()
            : contact.company === brokerageFilter;

      const reviewMatches =
        reviewFilter === 'all'
          ? true
          : contact.contact_review_status === reviewFilter;

      const searchMatches =
        !term ||
        [
          displayName(contact),
          contact.company,
          contact.job_title,
          contact.email,
          contact.phone,
          contact.mls_agent_id,
          contact.mls_office_id,
          contact.license_number,
          contact.contact_type,
          contact.relationship_status,
          contact.prospect_temperature,
          contact.is_archived
            ? 'archived'
            : '',
          contact.contact_review_status,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(term)
          );

      return (
        brokerageMatches &&
        reviewMatches &&
        searchMatches
      );
    });
  }, [
    contacts,
    search,
    brokerageFilter,
    reviewFilter,
  ]);

  const unknownBrokerageCount = useMemo(
    () =>
      contacts.filter(
        (contact) => !contact.company?.trim()
      ).length,
    [contacts]
  );

  const needsReviewCount = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.contact_review_status ===
          'needs_review'
      ).length,
    [contacts]
  );

  const eligibleCount = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.email &&
          contact.email_marketing_status === 'active' &&
          contact.do_not_contact !== true &&
          contact.is_archived !== true
      ).length,
    [contacts]
  );

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a
              href="/dashboard/email-marketing"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Email Marketing
            </a>

            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <Users className="h-4 w-4" />
              Marketing Contacts
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              Import and Manage Contacts
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Import CSV or tab-separated contact lists,
              prevent duplicate email records and categorize
              contacts for future campaigns.
            </p>
          </div>

          <button
            type="button"
            onClick={loadContacts}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Contacts
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {contacts.length}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Email Eligible
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {eligibleCount}
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Building2 className="h-4 w-4 text-violet-600" />
            Brokerages
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {brokerageOptions.length}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Directory Data Pending
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {needsReviewCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {unknownBrokerageCount} awaiting MLS verification
          </div>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Import Rows Detected
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {parsed.rows.length}
          </div>
        </div>
      </section>

      <ContactEnrichmentReviewPanel
        onDirectoryChanged={loadContacts}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Import Contacts
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Choose a CSV or tab-separated file, or paste the
            data directly below.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <label className="lg:col-span-6">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contact File
            </span>

            <input
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              onChange={handleFile}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700"
            />

            {fileName && (
              <div className="mt-1 text-xs text-slate-500">
                Selected: {fileName}
              </div>
            )}
          </label>

          <label className="lg:col-span-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fallback Brokerage
            </span>

            <input
              value={defaultCompany}
              onChange={(event) =>
                setDefaultCompany(event.target.value)
              }
              placeholder="Optional - CSV brokerage takes priority"
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="lg:col-span-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contact Category
            </span>

            <select
              value={defaultContactType}
              onChange={(event) =>
                setDefaultContactType(event.target.value)
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              {CONTACT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="lg:col-span-12">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Paste CSV or Tab-Separated Data
            </span>

            <textarea
              value={rawText}
              onChange={(event) => {
                setRawText(event.target.value);
                setFileName('');
              }}
              rows={8}
              placeholder="Paste the contact list here..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 font-mono text-xs"
            />
          </label>
        </div>

        {parsed.headers.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Confirm Column Mapping
            </h3>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ['first_name', 'First Name'],
                  ['last_name', 'Last Name'],
                  ['display_name', 'Full / Display Name'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                  ['company', 'Company / Brokerage'],
                  ['job_title', 'Job Title'],
                  ['mls_agent_id', 'MLS User Code'],
                  ['mls_office_id', 'MLS Office Code'],
                  ['license_number', 'License Number'],
                ] as const
              ).map(([field, label]) => (
                <label key={field}>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </span>

                  <select
                    value={mapping[field]}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Not mapped</option>

                    {parsed.headers.map((header, index) => (
                      <option
                        key={`${header}-${index}`}
                        value={String(index)}
                      >
                        {header || `Column ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              {defaultContactType === 'prospect' && (
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Default Temperature
                  </span>

                  <select
                    value={defaultProspectTemperature}
                    onChange={(event) =>
                      setDefaultProspectTemperature(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {PROSPECT_TEMPERATURES.map(
                      (temperature) => (
                        <option
                          key={temperature.value}
                          value={temperature.value}
                        >
                          {temperature.label}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}

              {usesRelationshipStatus(
                defaultContactType
              ) && (
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Default Status
                  </span>

                  <select
                    value={defaultRelationshipStatus}
                    onChange={(event) =>
                      setDefaultRelationshipStatus(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {RELATIONSHIP_STATUSES.map(
                      (status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}
            </div>

            <div className="mt-5">
              <button
                type="button"
                disabled={
                  importing ||
                  parsed.rows.length === 0 ||
                  !mapping.email
                }
                onClick={importContacts}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {importing
                  ? 'Importing...'
                  : `Import ${parsed.rows.length} Rows`}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Contact Database
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Showing {filteredContacts.length} of{' '}
              {contacts.length} contacts.
            </p>
          </div>

          <div className="grid w-full gap-2 md:w-auto md:grid-cols-[minmax(240px,320px)_220px_170px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search contacts..."
                className="w-full rounded-2xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"
              />
            </div>

            <select
              value={brokerageFilter}
              onChange={(event) =>
                setBrokerageFilter(event.target.value)
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">All Brokerages</option>
              <option value="unknown">
                Unknown Brokerage ({unknownBrokerageCount})
              </option>

              {brokerageOptions.map((brokerage) => (
                <option key={brokerage} value={brokerage}>
                  {brokerage}
                </option>
              ))}
            </select>

            <select
              value={reviewFilter}
              onChange={(event) =>
                setReviewFilter(event.target.value)
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">All Review Statuses</option>
              <option value="ready">Ready</option>
              <option value="needs_review">
                Directory Data Pending
              </option>
              <option value="unreviewed">Unreviewed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Brokerage</th>
                <th className="px-4 py-3">MLS ID</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">
                  Contact Category
                </th>
                <th className="px-4 py-3">
                  Status / Temperature
                </th>
                <th className="px-4 py-3">Email Status</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>

            <tbody>
              {filteredContacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-t border-slate-100"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {displayName(contact)}
                    </div>

                    <div className="text-xs text-slate-500">
                      {contact.job_title || '-'}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {contact.company || (
                      <span className="font-medium text-amber-700">
                        Unknown Brokerage
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {contact.mls_agent_id || '-'}
                  </td>

                  <td className="px-4 py-3">
                    {contact.email || '-'}
                  </td>

                  <td className="px-4 py-3">
                    {contact.phone || '-'}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${reviewStatusClasses(
                        contact.contact_review_status
                      )}`}
                    >
                      {reviewStatusLabel(
                        contact.contact_review_status
                      )}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <select
                      value={contact.contact_type}
                      disabled={savingContactId === contact.id}
                      onChange={(event) => {
                        const nextContactType =
                          event.target.value;

                        const nextRelationshipStatus =
                          usesRelationshipStatus(
                            nextContactType
                          )
                            ? contact.relationship_status ||
                              'active'
                            : null;

                        updateContact(contact.id, {
                          contact_type:
                            nextContactType,

                          relationship_status:
                            nextRelationshipStatus,

                          prospect_temperature:
                            nextContactType === 'prospect'
                              ? contact.prospect_temperature ||
                                'hot'
                              : null,

                          lifecycle_stage:
                            contact.is_archived
                              ? 'archived'
                              : legacyLifecycleForCategory(
                                  nextContactType,
                                  nextRelationshipStatus
                                ),
                        });
                      }}
                      className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
                    >
                      {CONTACT_TYPES.map((type) => (
                        <option
                          key={type.value}
                          value={type.value}
                        >
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      {contact.contact_type ===
                      'prospect' ? (
                        <select
                          value={
                            contact.prospect_temperature ||
                            'hot'
                          }
                          disabled={
                            savingContactId === contact.id
                          }
                          onChange={(event) =>
                            updateContact(contact.id, {
                              prospect_temperature:
                                event.target.value,
                            })
                          }
                          className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          {PROSPECT_TEMPERATURES.map(
                            (temperature) => (
                              <option
                                key={temperature.value}
                                value={temperature.value}
                              >
                                {temperature.label}
                              </option>
                            )
                          )}
                        </select>
                      ) : usesRelationshipStatus(
                          contact.contact_type
                        ) ? (
                        <select
                          value={
                            contact.relationship_status ||
                            'active'
                          }
                          disabled={
                            savingContactId === contact.id
                          }
                          onChange={(event) => {
                            const nextStatus =
                              event.target.value;

                            updateContact(contact.id, {
                              relationship_status:
                                nextStatus,

                              lifecycle_stage:
                                contact.is_archived
                                  ? 'archived'
                                  : legacyLifecycleForCategory(
                                      contact.contact_type,
                                      nextStatus
                                    ),
                            });
                          }}
                          className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
                        >
                          {RELATIONSHIP_STATUSES.map(
                            (status) => (
                              <option
                                key={status.value}
                                value={status.value}
                              >
                                {status.label}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Not applicable
                        </span>
                      )}

                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={contact.is_archived}
                          disabled={
                            savingContactId === contact.id
                          }
                          onChange={(event) => {
                            const isArchived =
                              event.target.checked;

                            updateContact(contact.id, {
                              is_archived: isArchived,

                              lifecycle_stage:
                                isArchived
                                  ? 'archived'
                                  : legacyLifecycleForCategory(
                                      contact.contact_type,
                                      contact.relationship_status
                                    ),
                            });
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />

                        Archived
                      </label>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <select
                      value={contact.email_marketing_status}
                      disabled={savingContactId === contact.id}
                      onChange={(event) =>
                        updateContact(contact.id, {
                          email_marketing_status:
                            event.target.value,
                        })
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
                    >
                      {EMAIL_STATUSES.map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(contact.created_at)}
                  </td>
                </tr>
              ))}

              {!loading && filteredContacts.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No contacts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="p-5 text-sm text-slate-500">
            Loading contacts...
          </div>
        )}
      </section>
    </div>
  );
}
