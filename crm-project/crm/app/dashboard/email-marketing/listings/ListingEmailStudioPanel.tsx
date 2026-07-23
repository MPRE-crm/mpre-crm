'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Check,
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  Monitor,
  Pencil,
  Save,
  Smartphone,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

import {
  buildEmailHtml,
  normalizeTemplateKey,
  type Listing,
  type ListingPhoto,
  type Profile,
} from '../../../../lib/listing-email-creative';


const supabase =
  getSupabaseBrowser();

export type StudioEmailListing =
  Listing & {
    org_id: string;
  };

export type StudioEmailSection = {
  id: string;
  listing_id: string;
  section_key: string;
  status: string;
  template_key: string;
  template_locked: boolean;
  content:
    Record<string, unknown>;
  manual_override: boolean;
  generation_version: number;
  approved_at:
    | string
    | null;
};

export type StudioEmailPhoto =
  ListingPhoto & {
    thumbnail_url:
      | string
      | null;

    file_name: string;
  };

export type StudioEmailAssignment = {
  id: string;
  section_key: string;
  slot_key: string;
  sort_order: number;
  media_id: string;

  selected_by:
    | 'samantha'
    | 'agent';

  is_locked: boolean;
};

type ListingEmailStudioPanelProps = {
  listing:
    StudioEmailListing;

  section:
    | StudioEmailSection
    | null;

  photos:
    StudioEmailPhoto[];

  assignments:
    StudioEmailAssignment[];

  onRefresh: () =>
    Promise<void>;
};

function stringValue(
  value: unknown,
  fallback = ''
) {
  return typeof value ===
    'string'
    ? value
    : fallback;
}

function assignmentRank(
  assignment:
    StudioEmailAssignment
) {
  if (
    assignment.slot_key ===
    'hero'
  ) {
    return -1000;
  }

  return assignment.sort_order;
}

export default function ListingEmailStudioPanel({
  listing,
  section,
  photos,
  assignments,
  onRefresh,
}: ListingEmailStudioPanelProps) {
  const [
    profile,
    setProfile,
  ] = useState<
    Profile | null
  >(null);

  const [
    loadingProfile,
    setLoadingProfile,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    previewMode,
    setPreviewMode,
  ] = useState<
    'desktop' | 'mobile'
  >('desktop');

  const [
    subject,
    setSubject,
  ] = useState('');

  const [
    previewText,
    setPreviewText,
  ] = useState('');

  const [
    headline,
    setHeadline,
  ] = useState('');

  const [
    body,
    setBody,
  ] = useState('');

  const [
    fullDescription,
    setFullDescription,
  ] = useState('');

  const [
    ctaLabel,
    setCtaLabel,
  ] = useState(
    'View Full Listing'
  );


  const [
    dirty,
    setDirty,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    notice,
    setNotice,
  ] = useState<
    string | null
  >(null);

  const selectedPhotos =
    useMemo(() => {
      const photoById =
        new Map(
          photos.map(
            (photo) => [
              photo.id,
              photo,
            ]
          )
        );

      const selected:
        StudioEmailPhoto[] = [];

      const seen =
        new Set<string>();

      assignments
        .filter(
          (assignment) =>
            assignment
              .section_key ===
            'email'
        )
        .slice()
        .sort(
          (left, right) =>
            assignmentRank(
              left
            ) -
            assignmentRank(
              right
            )
        )
        .forEach(
          (assignment) => {
            const photo =
              photoById.get(
                assignment.media_id
              );

            if (
              photo &&
              !seen.has(
                photo.id
              )
            ) {
              selected.push(
                photo
              );

              seen.add(
                photo.id
              );
            }
          }
        );

      if (
        selected.length >
        0
      ) {
        return selected;
      }

      return photos
        .filter(
          (photo) =>
            photo.use_in_marketing
        )
        .slice()
        .sort(
          (left, right) => {
            if (
              left.is_primary !==
              right.is_primary
            ) {
              return left.is_primary
                ? -1
                : 1;
            }

            return (
              left.sort_order -
              right.sort_order
            );
          }
        )
        .slice(0, 6);
    }, [
      photos,
      assignments,
    ]);

  const templateKey =
    normalizeTemplateKey(
      section?.template_key
    );

  useEffect(() => {
    const content =
      section?.content ||
      {};

    const fallbackHeadline =
      listing
        .campaign_headline ||
      listing.title;

    const fallbackBody =
      listing
        .short_marketing_description ||
      listing.public_remarks ||
      listing.description ||
      '';

    setSubject(
      stringValue(
        content.subject,
        `New Listing: ${listing.title}`
      )
    );

    setPreviewText(
      stringValue(
        content.preview_text,
        fallbackBody
      )
    );

    setHeadline(
      stringValue(
        content.headline,
        fallbackHeadline
      )
    );

    setBody(
      stringValue(
        content.body,
        fallbackBody
      )
    );

    setFullDescription(
      stringValue(
        content.full_description,
        listing.public_remarks ||
          listing.description ||
          ''
      )
    );

    setCtaLabel(
      stringValue(
        content.cta_label,
        'View Full Listing'
      )
    );


    setDirty(false);

    setEditing(
      !section ||
      Object.keys(
        content
      ).length === 0
    );
  }, [
    listing,
    section,
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setLoadingProfile(
          true
        );

        setError(null);

        const {
          data: userResult,
          error: userError,
        } = await supabase
          .auth
          .getUser();

        if (
          userError ||
          !userResult.user
        ) {
          throw new Error(
            userError?.message ||
              'Your CRM session expired.'
          );
        }

        const {
          data: profileRow,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select('*')
          .eq(
            'id',
            userResult.user.id
          )
          .single();

        if (
          profileError ||
          !profileRow
        ) {
          throw new Error(
            profileError?.message ||
              'Marketing profile not found.'
          );
        }

        const {
          data: sessionResult,
          error: sessionError,
        } = await supabase
          .auth
          .getSession();

        if (
          sessionError ||
          !sessionResult.session
        ) {
          throw new Error(
            sessionError?.message ||
              'Your CRM session expired.'
          );
        }

        const response =
          await fetch(
            '/api/preferences/organization-compliance',
            {
              method:
                'GET',

              headers: {
                Authorization:
                  `Bearer ${sessionResult.session.access_token}`,
              },

              cache:
                'no-store',
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.error ||
              'Could not load brokerage compliance settings.'
          );
        }

        if (mounted) {
          setProfile({
            ...result.organization,
            ...profileRow,
          } as Profile);
        }
      } catch (
        profileError: any
      ) {
        if (mounted) {
          setError(
            profileError
              ?.message ||
              'Could not load the email marketing identity.'
          );
        }
      } finally {
        if (mounted) {
          setLoadingProfile(
            false
          );
        }
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const previewHtml =
    useMemo(() => {
      if (!profile) {
        return '';
      }

      return buildEmailHtml({
        listing: {
          ...listing,

          public_remarks:
            fullDescription,

          description:
            fullDescription,
        },

        photos:
          selectedPhotos,

        photoCount:
          Math.max(
            1,
            selectedPhotos.length
          ),

        headline,

        description:
          '',

        previewText,

        campaignType:
          'listing_ad',

        templateKey,

        generatedArtworkUrl:
          '',

        primaryCtaLabel:
          ctaLabel,

        audienceContactType:
          'realtor',

        profile,
      });
    }, [
      profile,
      listing,
      selectedPhotos,
      headline,
      fullDescription,
      previewText,
      templateKey,
      ctaLabel,
    ]);

  const senderReady =
    Boolean(
      profile
        ?.marketing_from_name &&
      profile
        ?.marketing_from_email &&
      profile
        ?.marketing_reply_to_email &&
      profile
        ?.marketing_email_enabled
    );

  const complianceReady =
    Boolean(
      profile
        ?.marketing_physical_address &&
      profile
        ?.marketing_licensed_business_name &&
      profile
        ?.marketing_privacy_policy_url
    );

  function changeField(
    setter:
      (value: string) =>
        void,
    value: string
  ) {
    setter(value);
    setDirty(true);
    setError(null);
    setNotice(null);
  }

  async function saveCreative(
    nextStatus:
      | 'needs_review'
      | 'approved'
  ) {
    if (!section) {
      setError(
        'The Email section has not been prepared yet.'
      );

      return;
    }

    if (
      !subject.trim() ||
      !previewText.trim() ||
      !headline.trim() ||
      !fullDescription.trim() ||
      !ctaLabel.trim()
    ) {
      setError(
        'Complete the subject, inbox preview, headline, full listing description and main button text.'
      );

      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const {
        data: userResult,
        error: userError,
      } = await supabase
        .auth
        .getUser();

      if (
        userError ||
        !userResult.user
      ) {
        throw new Error(
          userError?.message ||
            'Your CRM session expired.'
        );
      }

      const approvedAt =
        nextStatus ===
        'approved'
          ? new Date()
              .toISOString()
          : null;

      const nextContent = {
        ...section.content,

        subject:
          subject.trim(),

        preview_text:
          previewText.trim(),

        headline:
          headline.trim(),

        body:
          body.trim(),

        full_description:
          fullDescription.trim(),

        cta_label:
          ctaLabel.trim(),

        generated_asset_id:
          null,

        generated_asset_url:
          null,

        generated_asset_format:
          null,
      };

      const {
        error: saveError,
      } = await supabase
        .from(
          'listing_marketing_sections'
        )
        .update({
          content:
            nextContent,

          manual_override:
            section
              .manual_override ||
            dirty,

          status:
            nextStatus,

          approved_at:
            approvedAt,

          approved_by:
            nextStatus ===
            'approved'
              ? userResult.user.id
              : null,

          updated_by:
            userResult.user.id,
        })
        .eq(
          'id',
          section.id
        );

      if (saveError) {
        throw saveError;
      }

      setDirty(false);
      setEditing(false);

      setNotice(
        nextStatus ===
        'approved'
          ? 'Email advertisement approved.'
          : 'Email draft saved. Review the preview, then approve it.'
      );

      await onRefresh();
    } catch (
      saveError: any
    ) {
      setError(
        saveError?.message ||
          'Could not save the email advertisement.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {notice}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-violet-700">
              <Mail className="h-4 w-4" />
              Email Advertisement
            </div>

            <h3 className="mt-2 text-xl font-bold text-slate-950">
              Creative Review and Approval
            </h3>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Choose a complete email style, then finalize the subject, wording and selected property photos here.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setEditing(
                  (current) =>
                    !current
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />

              {editing
                ? 'Close Editor'
                : 'Edit Email'}
            </button>

            <button
              type="button"
              disabled={
                saving ||
                loadingProfile ||
                !section
              }
              onClick={() =>
                void saveCreative(
                  'needs_review'
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              Save Draft
            </button>

            <button
              type="button"
              disabled={
                saving ||
                loadingProfile ||
                !section
              }
              onClick={() =>
                void saveCreative(
                  'approved'
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />

              {section?.status ===
              'approved'
                ? 'Approved'
                : 'Approve Email'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Creative Status
            </div>

            <div className={`mt-2 font-bold ${
              section?.status ===
              'approved'
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}>
              {section?.status ===
              'approved'
                ? 'Approved'
                : 'Needs Review'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Sender Identity
            </div>

            <div className={`mt-2 font-bold ${
              senderReady
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}>
              {senderReady
                ? 'Ready'
                : 'Needs Attention'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Email Compliance
            </div>

            <div className={`mt-2 font-bold ${
              complianceReady
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}>
              {complianceReady
                ? 'Ready'
                : 'Needs Attention'}
            </div>
          </div>
        </div>
      </section>

      {editing && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-700" />

            <h3 className="font-bold text-slate-950">
              Email Wording
            </h3>
          </div>

          <div className="mt-4 grid gap-4">
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Email Subject
              </span>

              <input
                value={subject}
                onChange={(event) =>
                  changeField(
                    setSubject,
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Inbox Preview Text
              </span>

              <textarea
                value={previewText}
                onChange={(event) =>
                  changeField(
                    setPreviewText,
                    event.target.value
                  )
                }
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Email Headline
              </span>

              <input
                value={headline}
                onChange={(event) =>
                  changeField(
                    setHeadline,
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>


            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Full Public Listing Description
              </span>

              <textarea
                value={fullDescription}
                onChange={(event) =>
                  changeField(
                    setFullDescription,
                    event.target.value
                  )
                }
                rows={8}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Main Button Text
              </span>

              <input
                value={ctaLabel}
                onChange={(event) =>
                  changeField(
                    setCtaLabel,
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-violet-700" />

            <div>
              <h3 className="font-bold text-slate-950">
                Live Email Preview
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                Preview the finished advertisement before approving it.
              </p>
            </div>
          </div>

          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() =>
                setPreviewMode(
                  'desktop'
                )
              }
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                previewMode ===
                'desktop'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Desktop
            </button>

            <button
              type="button"
              onClick={() =>
                setPreviewMode(
                  'mobile'
                )
              }
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                previewMode ===
                'mobile'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              Mobile
            </button>
          </div>
        </div>

        {loadingProfile ? (
          <div className="mt-5 flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Preparing email preview...
          </div>
        ) : previewHtml ? (
          <div className="mt-5 overflow-x-auto rounded-2xl bg-slate-100 p-4">
            <iframe
              title="Marketing Studio email preview"
              srcDoc={previewHtml}
              className={`mx-auto h-[940px] rounded-xl border border-slate-200 bg-white transition-all ${
                previewMode ===
                'mobile'
                  ? 'w-[390px] max-w-full'
                  : 'w-full'
              }`}
            />
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
            The email preview could not be prepared.
          </div>
        )}
      </section>

      {section?.status ===
        'approved' &&
        !dirty && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Approved email creative is ready for campaign delivery.
        </div>
      )}
    </div>
  );
}
