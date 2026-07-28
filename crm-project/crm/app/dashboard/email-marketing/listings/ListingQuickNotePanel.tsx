'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquareReply,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';

import {
  getSupabaseBrowser,
} from '../../../../lib/supabase-browser';

import type {
  Listing,
  LuxuryEmailEditionKey,
  Profile,
} from '../../../../lib/listing-email-creative';

import {
  buildQuickNoteEmail,
  QUICK_NOTE_AUDIENCES,
  type QuickNoteAudience,
} from '../../../../lib/quick-note-email';

const supabase =
  getSupabaseBrowser();

type ListingQuickNotePanelProps = {
  listing: Listing;
  profile: Profile | null;

  luxuryEdition:
    LuxuryEmailEditionKey;

  editionHeadline:
    string;

  editionBody:
    string;
};

type SamanthaSubjectOption = {
  subject: string;
  preview_text: string;
  reason: string;
};

type SamanthaSubjectSet = {
  options:
    SamanthaSubjectOption[];

  recommended_index:
    number;

  model:
    string;
};

const AUDIENCE_DESCRIPTIONS:
  Record<
    QuickNoteAudience,
    {
      label: string;
      description: string;
    }
  > = {
    reverse_prospecting_realtor: {
      label: 'Reverse-Prospecting Realtor',
      description:
        'Carefully mentions that the Realtor may have a client whose search lines up with the property.',
    },

    realtor: {
      label: 'Realtor',
      description:
        'Asks whether the Realtor has a buyer who may be a fit.',
    },

    lender: {
      label: 'Lender',
      description:
        'Asks whether anyone in the lender client or agent network comes to mind.',
    },

    title_escrow: {
      label: 'Title / Escrow',
      description:
        'Uses professional network wording for clients, agents and contacts connected to the title or escrow professional.',
    },

    professional: {
      label: 'Professional',
      description:
        'Places the property on their radar for someone in their professional network.',
    },

    active_client: {
      label: 'Active Client',
      description:
        'Speaks directly to a Buyer, Seller or Buyer & Seller about whether the property could fit their own needs or home search.',
    },

    past_client: {
      label: 'Past or Closed Client',
      description:
        'Uses friendly referral wording for someone in the client circle.',
    },

    sphere: {
      label: 'Sphere of Influence',
      description:
        'Uses a personal note asking whether someone they know may be a fit.',
    },

    vendor_partner: {
      label: 'Vendor or Partner',
      description:
        'Places the property on their radar for anyone in their professional network.',
    },

    prospect: {
      label: 'Prospect',
      description:
        'Treats the recipient as a prospective consumer and asks whether the property is worth considering for them.',
    },

    unknown: {
      label: 'General Contact',
      description:
        'Uses safe general wording when the relationship is Other or cannot be confidently classified.',
    },
  };
export default function ListingQuickNotePanel({
  listing,
  profile,
  luxuryEdition,
  editionHeadline,
  editionBody,
}: ListingQuickNotePanelProps) {
  const [
    audience,
    setAudience,
  ] = useState<
    QuickNoteAudience
  >('realtor');

  const [
    firstName,
    setFirstName,
  ] = useState('Sarah');

  const [
    subjectOverrides,
    setSubjectOverrides,
  ] = useState<
    Partial<
      Record<
        QuickNoteAudience,
        string
      >
    >
  >({});

  const [
    previewTextOverrides,
    setPreviewTextOverrides,
  ] = useState<
    Partial<
      Record<
        QuickNoteAudience,
        string
      >
    >
  >({});

  const [
    editionMessageOverrides,
    setEditionMessageOverrides,
  ] = useState<
    Partial<
      Record<
        QuickNoteAudience,
        string
      >
    >
  >({});

  const [
    subjectSets,
    setSubjectSets,
  ] = useState<
    Partial<
      Record<
        QuickNoteAudience,
        SamanthaSubjectSet
      >
    >
  >({});

  const [
    subjectLoadingAudience,
    setSubjectLoadingAudience,
  ] = useState<
    QuickNoteAudience | null
  >(null);

  const [
    subjectError,
    setSubjectError,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    setSubjectOverrides({});
    setPreviewTextOverrides({});
    setEditionMessageOverrides({});
    setSubjectSets({});
    setSubjectError(null);
  }, [
    luxuryEdition,
  ]);

  const quickNote =
    useMemo(() => {
      if (!profile) {
        return null;
      }

      return buildQuickNoteEmail({
        listing,
        profile,
        audience,

        luxury_edition:
          luxuryEdition,

        edition_headline:
          editionHeadline,

        edition_body:
          editionBody,

        edition_message_override:
          editionMessageOverrides[
            audience
          ],

        subject_override:
          subjectOverrides[
            audience
          ],

        preview_text_override:
          previewTextOverrides[
            audience
          ],

        contact: {
          first_name:
            firstName,
        },
      });
    }, [
      listing,
      profile,
      audience,
      firstName,
      luxuryEdition,
      editionHeadline,
      editionBody,
      subjectOverrides,
      previewTextOverrides,
      editionMessageOverrides,
    ]);

  const currentSubjectSet =
    subjectSets[
      audience
    ] ||
    null;

  const generatingSubjects =
    subjectLoadingAudience ===
    audience;

  const subjectGenerationBusy =
    subjectLoadingAudience !==
    null;

  function chooseSubjectOption(
    option:
      SamanthaSubjectOption
  ) {
    setSubjectOverrides(
      (current) => ({
        ...current,

        [audience]:
          option.subject,
      })
    );

    setPreviewTextOverrides(
      (current) => ({
        ...current,

        [audience]:
          option
            .preview_text,
      })
    );

    setEditionMessageOverrides(
      (current) => ({
        ...current,

        [audience]:
          option.reason,
      })
    );
  }

  function useCategoryFallback() {
    setSubjectOverrides(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          audience
        ];

        return next;
      }
    );

    setPreviewTextOverrides(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          audience
        ];

        return next;
      }
    );

    setEditionMessageOverrides(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          audience
        ];

        return next;
      }
    );
  }

  async function generateSamanthaSubjects() {
    try {
      setSubjectLoadingAudience(
        audience
      );

      setSubjectError(
        null
      );

      const {
        data:
          sessionData,

        error:
          sessionError,
      } =
        await supabase
          .auth
          .getSession();

      const accessToken =
        sessionData
          .session
          ?.access_token;

      if (
        sessionError ||
        !accessToken
      ) {
        throw new Error(
          sessionError
            ?.message ||
          'Your CRM session expired.'
        );
      }

      const response =
        await fetch(
          '/api/marketing/quick-note-subjects/generate',
          {
            method:
              'POST',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                listing_id:
                  listing.id,

                audience,

                luxury_edition:
                  luxuryEdition,

                edition_headline:
                  editionHeadline,

                edition_body:
                  editionBody,
              }),

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
          'Samantha could not generate subject-line recommendations.'
        );
      }

      const options:
        SamanthaSubjectOption[] =
        Array.isArray(
          result?.options
        )
          ? result.options.filter(
              (
                option:
                  any
              ): option is
                SamanthaSubjectOption =>
                typeof option
                  ?.subject ===
                  'string' &&
                typeof option
                  ?.preview_text ===
                  'string' &&
                typeof option
                  ?.reason ===
                  'string'
            )
          : [];

      if (
        options.length !==
        3
      ) {
        throw new Error(
          'Samantha did not return three usable subject-line options.'
        );
      }

      const proposedIndex =
        Number(
          result
            ?.recommended_index
        );

      const recommendedIndex =
        Number.isInteger(
          proposedIndex
        ) &&
        proposedIndex >= 0 &&
        proposedIndex <
          options.length
          ? proposedIndex
          : 0;

      const generatedSet:
        SamanthaSubjectSet = {
          options,

          recommended_index:
            recommendedIndex,

          model:
            typeof result
              ?.model ===
              'string'
              ? result.model
              : '',
        };

      setSubjectSets(
        (current) => ({
          ...current,

          [audience]:
            generatedSet,
        })
      );

      chooseSubjectOption(
        options[
          recommendedIndex
        ]
      );
    }
    catch (
      generationError:
        any
    ) {
      setSubjectError(
        generationError
          ?.message ||
        'Samantha subject generation failed.'
      );
    }
    finally {
      setSubjectLoadingAudience(
        null
      );
    }
  }

  const signatureReady =
    Boolean(
      profile
        ?.marketing_signature_image_url ||
      profile
        ?.marketing_signature_text
    );

  return (
    <section className="rounded-3xl border border-blue-200 bg-blue-50/30 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
            <MessageSquareReply className="h-4 w-4" />
            Quick Note Follow-Up
          </div>

          <h3 className="mt-2 text-xl font-bold text-slate-950">
            Personal Follow-Up From the Listing Agent
          </h3>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Samantha changes the wording based on both the selected email edition and the contact relationship. The note stays personal, matches the property angle and stops immediately after a reply.
          </p>
        </div>

        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
          Stop After Reply: On
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <UserRoundCheck className="h-4 w-4" />
            Audience Version
          </div>

          <div className="mt-2 font-bold text-blue-700">
            {
              AUDIENCE_DESCRIPTIONS[
                audience
              ].label
            }
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Mail className="h-4 w-4" />
            Personal Signature
          </div>

          <div
            className={`mt-2 font-bold ${
              signatureReady
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}
          >
            {signatureReady
              ? 'Ready'
              : 'Typed Fallback'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <CheckCircle2 className="h-4 w-4" />
            Reply Protection
          </div>

          <div className="mt-2 font-bold text-emerald-700">
            Sequence Stops
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-sm font-bold text-slate-950">
          Preview Each Contact Relationship
        </div>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          Samantha will choose the correct version from the contact type, lifecycle stage, tags, source and verified reverse-prospecting information.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_NOTE_AUDIENCES.map(
            (option) => {
              const selected =
                audience ===
                option;

              const details =
                AUDIENCE_DESCRIPTIONS[
                  option
                ];

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setAudience(
                      option
                    );

                    setSubjectError(
                      null
                    );
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-blue-500 bg-white ring-2 ring-blue-100'
                      : 'border-slate-200 bg-white/80 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-bold text-slate-950">
                      {details.label}
                    </div>

                    {selected && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-700" />
                    )}
                  </div>

                  <div className="mt-2 text-sm leading-5 text-slate-600">
                    {
                      details.description
                    }
                  </div>
                </button>
              );
            }
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label>
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Preview First Name
            </span>

            <input
              value={firstName}
              onChange={(event) =>
                setFirstName(
                  event.target.value
                )
              }
              placeholder="Sarah"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            />
          </label>

          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Samantha Subject Line
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  subjectOverrides[
                    audience
                  ] !==
                    undefined ||
                  previewTextOverrides[
                    audience
                  ] !==
                    undefined
                ) && (
                  <button
                    type="button"
                    onClick={
                      useCategoryFallback
                    }
                    className="text-xs font-bold text-blue-700 hover:text-blue-900"
                  >
                    Use Category Fallback
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    void generateSamanthaSubjects()
                  }
                  disabled={
                    subjectGenerationBusy
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingSubjects ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}

                  {generatingSubjects
                    ? 'Samantha Is Thinking...'
                    : currentSubjectSet
                      ? 'Regenerate Options'
                      : 'Ask Samantha'}
                </button>
              </div>
            </div>

            <input
              value={
                quickNote?.subject ||
                ''
              }
              onChange={(event) =>
                setSubjectOverrides(
                  (current) => ({
                    ...current,

                    [audience]:
                      event.target.value,
                  })
                )
              }
              placeholder="Subject line"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
            />

            <div className="mt-4">
              <label>
                <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Inbox Preview Text
                </span>

                <textarea
                  value={
                    quickNote
                      ?.preview_text ||
                    ''
                  }
                  onChange={(event) =>
                    setPreviewTextOverrides(
                      (current) => ({
                        ...current,

                        [audience]:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  rows={3}
                  placeholder="Inbox preview text"
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-700"
                />
              </label>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Ask Samantha to evaluate the selected edition, listing facts and relationship category. Each recommendation includes a subject, inbox preview and matching follow-up paragraph explaining why the primary email deserves a look.
            </p>

            {subjectError && (
              <div className="mt-3 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                {subjectError}
              </div>
            )}

            {currentSubjectSet && (
              <div className="mt-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wide text-violet-700">
                  Samantha's Three Recommendations
                </div>

                {currentSubjectSet
                  .options
                  .map(
                    (
                      option,
                      index
                    ) => {
                      const selected =
                        subjectOverrides[
                          audience
                        ] ===
                          option.subject &&
                        previewTextOverrides[
                          audience
                        ] ===
                          option
                            .preview_text;

                      const recommended =
                        index ===
                        currentSubjectSet
                          .recommended_index;

                      return (
                        <button
                          key={`${option.subject}-${index}`}
                          type="button"
                          onClick={() =>
                            chooseSubjectOption(
                              option
                            )
                          }
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            selected
                              ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                              : 'border-slate-200 bg-white hover:border-violet-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Option {index + 1}
                            </span>

                            {recommended && (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">
                                Samantha Recommends
                              </span>
                            )}
                          </div>

                          <div className="mt-2 text-sm font-bold text-slate-950">
                            {option.subject}
                          </div>

                          <div className="mt-2 text-xs leading-5 text-slate-600">
                            <span className="font-bold">
                              Inbox preview:
                            </span>{' '}

                            {
                              option
                                .preview_text
                            }
                          </div>

                          <div className="mt-2 text-xs leading-5 text-slate-500">
                            <span className="font-bold text-slate-600">
                              Follow-up paragraph:
                            </span>{' '}

                            {
                              option
                                .reason
                            }
                          </div>
                        </button>
                      );
                    }
                  )}
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Samantha Classification
            </div>

            <div className="mt-2 text-sm leading-6 text-slate-600">
              {
                AUDIENCE_DESCRIPTIONS[
                  audience
                ].description
              }
            </div>
          </div>

          {audience ===
            'unknown' && (
            <div className="mt-5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

              Samantha will use the safe general version and flag the contact for classification review.
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-4">
          {quickNote?.html ? (
            <iframe
              title="Quick Note email preview"
              srcDoc={
                quickNote.html
              }
              className="h-[700px] w-full rounded-xl border border-slate-200 bg-white"
            />
          ) : (
            <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              Preparing Quick Note preview...
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4 text-sm leading-6 text-slate-600">
        This workspace currently previews Samantha's relationship-aware wording. Scheduling, recipient behavior checks, suppression rules and delivery controls will be connected in the campaign workflow next.
      </div>
    </section>
  );
}