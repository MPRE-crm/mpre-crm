'use client';

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import { getSupabaseBrowser } from '../../../../lib/supabase-browser';

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
  job_title: string | null;
  email: string | null;
  phone: string | null;
  contact_type: string;
  lifecycle_stage: string;
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
};

const CONTACT_TYPES = [
  { value: 'consumer', label: 'Consumer' },
  { value: 'realtor', label: 'Realtor' },
  { value: 'lender', label: 'Lender' },
  { value: 'builder', label: 'Builder' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'title_escrow', label: 'Title / Escrow' },
  { value: 'professional', label: 'Professional' },
  { value: 'other', label: 'Other' },
];

const LIFECYCLE_STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'active_buyer', label: 'Active Buyer' },
  { value: 'active_seller', label: 'Active Seller' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'closed_client', label: 'Closed Client' },
  { value: 'past_client', label: 'Past Client' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'referral_partner', label: 'Referral Partner' },
  { value: 'lost', label: 'Lost' },
  { value: 'archived', label: 'Archived' },
];

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
      'office',
      'organization',
    ]),

    job_title: findHeaderIndex(headers, [
      'job title',
      'title',
      'position',
      'role',
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
    useState('Homes of Idaho');

  const [defaultContactType, setDefaultContactType] =
    useState('realtor');

  const [defaultLifecycle, setDefaultLifecycle] =
    useState('prospect');

  const [search, setSearch] = useState('');

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
          job_title,
          email,
          phone,
          contact_type,
          lifecycle_stage,
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

          contact_type: defaultContactType,
          lifecycle_stage: defaultLifecycle,

          tags: [
            'Homes of Idaho',
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

      const importedEmails = payload.map(
        (row) => row.email
      );

      const existingEmails = new Set<string>();

      for (
        let start = 0;
        start < importedEmails.length;
        start += 500
      ) {
        const emailBatch = importedEmails.slice(
          start,
          start + 500
        );

        const { data: existing, error: existingError } =
          await supabase
            .from('contacts')
            .select('email_normalized')
            .eq('org_id', profile.org_id)
            .in('email_normalized', emailBatch);

        if (existingError) {
          throw new Error(existingError.message);
        }

        for (const contact of existing || []) {
          if (contact.email_normalized) {
            existingEmails.add(
              String(contact.email_normalized)
            );
          }
        }
      }

      for (
        let start = 0;
        start < payload.length;
        start += 250
      ) {
        const batch = payload.slice(
          start,
          start + 250
        );

        const { error: importError } = await supabase
          .from('contacts')
          .upsert(batch, {
            onConflict: 'org_id,email_normalized',
            ignoreDuplicates: true,
          });

        if (importError) {
          throw new Error(importError.message);
        }
      }

      const newCount =
        payload.length - existingEmails.size;

      await loadContacts();

      setNotice(
        [
          `${newCount} new contacts imported.`,
          `${existingEmails.size} existing emails skipped.`,
          `${invalidEmailCount} rows without valid emails skipped.`,
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

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return contacts;

    return contacts.filter((contact) =>
      [
        displayName(contact),
        contact.company,
        contact.job_title,
        contact.email,
        contact.phone,
        contact.contact_type,
        contact.lifecycle_stage,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(term)
        )
    );
  }, [contacts, search]);

  const eligibleCount = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.email &&
          contact.email_marketing_status === 'active' &&
          contact.do_not_contact !== true &&
          contact.lifecycle_stage !== 'archived'
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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Import Rows Detected
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {parsed.rows.length}
          </div>
        </div>
      </section>

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
              Default Company
            </span>

            <input
              value={defaultCompany}
              onChange={(event) =>
                setDefaultCompany(event.target.value)
              }
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="lg:col-span-3">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contact Type
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

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Default Lifecycle
                </span>

                <select
                  value={defaultLifecycle}
                  onChange={(event) =>
                    setDefaultLifecycle(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {LIFECYCLE_STAGES.map((stage) => (
                    <option
                      key={stage.value}
                      value={stage.value}
                    >
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
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

          <div className="relative w-full md:w-80">
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
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Lifecycle</th>
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
                    {contact.company || '-'}
                  </td>

                  <td className="px-4 py-3">
                    {contact.email || '-'}
                  </td>

                  <td className="px-4 py-3">
                    {contact.phone || '-'}
                  </td>

                  <td className="px-4 py-3">
                    <select
                      value={contact.contact_type}
                      disabled={savingContactId === contact.id}
                      onChange={(event) =>
                        updateContact(contact.id, {
                          contact_type: event.target.value,
                        })
                      }
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
                    <select
                      value={contact.lifecycle_stage}
                      disabled={savingContactId === contact.id}
                      onChange={(event) =>
                        updateContact(contact.id, {
                          lifecycle_stage:
                            event.target.value,
                        })
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
                    >
                      {LIFECYCLE_STAGES.map((stage) => (
                        <option
                          key={stage.value}
                          value={stage.value}
                        >
                          {stage.label}
                        </option>
                      ))}
                    </select>
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
                    colSpan={8}
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
