'use client';

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';

import { getSupabaseBrowser } from '../../../../lib/supabase-browser';

const supabase = getSupabaseBrowser();

export type ListingMediaSummary = {
  photoCount: number;
  videoCount: number;
  brandedVideoCount: number;
  unbrandedVideoCount: number;
  hasPrimaryPhoto: boolean;
};

type ListingMediaRow = {
  id: string;
  intake_session_id: string;
  listing_id: string | null;

  org_id: string;
  owner_user_id: string;

  media_type: 'photo' | 'video';

  branding_type:
    | 'none'
    | 'branded'
    | 'unbranded';

  storage_bucket: string;
  storage_path: string;
  public_url: string;

  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;

  title: string | null;
  caption: string | null;

  sort_order: number;
  is_primary: boolean;
  use_in_marketing: boolean;

  thumbnail_storage_path: string | null;
  thumbnail_url: string | null;

  created_at: string;
};

type Props = {
  intakeSessionId: string;
  listingId?: string | null;

  orgId: string;
  ownerUserId: string;
  createdBy: string;

  disabled?: boolean;

  onSummaryChange?: (
    summary: ListingMediaSummary
  ) => void;
};

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .replace(/-+/g, '-') ||
    'listing-media'
  );
}

function formatBytes(value?: number | null) {
  if (!value) return '-';

  const megabytes =
    value / 1024 / 1024;

  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)} MB`;
  }

  return `${(value / 1024).toFixed(1)} KB`;
}

function isPhotoFile(file: File) {
  return (
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(
      file.name
    )
  );
}

function isVideoFile(file: File) {
  return (
    file.type.startsWith('video/') ||
    /\.(mp4|mov|webm|m4v)$/i.test(
      file.name
    )
  );
}

export default function ListingMediaManager({
  intakeSessionId,
  listingId = null,

  orgId,
  ownerUserId,
  createdBy,

  disabled = false,

  onSummaryChange,
}: Props) {
  const [mediaRows, setMediaRows] =
    useState<ListingMediaRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [workingId, setWorkingId] =
    useState<string | null>(null);

  const [progressText, setProgressText] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [photosOpen, setPhotosOpen] =
    useState(true);

  const [videosOpen, setVideosOpen] =
    useState(false);

  const [
    selectedPhotoId,
    setSelectedPhotoId,
  ] = useState<string | null>(null);

  const [
    draggedPhotoId,
    setDraggedPhotoId,
  ] = useState<string | null>(null);

  const [photoInputKey, setPhotoInputKey] =
    useState(0);

  const [
    brandedVideoInputKey,
    setBrandedVideoInputKey,
  ] = useState(0);

  const [
    unbrandedVideoInputKey,
    setUnbrandedVideoInputKey,
  ] = useState(0);

  const photos = useMemo(
    () =>
      mediaRows
        .filter(
          (media) =>
            media.media_type === 'photo'
        )
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order
        ),
    [mediaRows]
  );

  const videos = useMemo(
    () =>
      mediaRows
        .filter(
          (media) =>
            media.media_type === 'video'
        )
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order
        ),
    [mediaRows]
  );

  const selectedPhoto = useMemo(
    () =>
      photos.find(
        (photo) =>
          photo.id === selectedPhotoId
      ) || null,
    [photos, selectedPhotoId]
  );

  const marketingPhotoCount = useMemo(
    () =>
      photos.filter(
        (photo) =>
          photo.use_in_marketing
      ).length,
    [photos]
  );

  const summary = useMemo<
    ListingMediaSummary
  >(() => {
    const brandedVideoCount =
      videos.filter(
        (video) =>
          video.branding_type === 'branded'
      ).length;

    const unbrandedVideoCount =
      videos.filter(
        (video) =>
          video.branding_type ===
          'unbranded'
      ).length;

    return {
      photoCount: photos.length,
      videoCount: videos.length,
      brandedVideoCount,
      unbrandedVideoCount,

      hasPrimaryPhoto:
        photos.some(
          (photo) =>
            photo.is_primary
        ),
    };
  }, [photos, videos]);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  async function loadMedia() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('listing_media')
        .select(`
          id,
          intake_session_id,
          listing_id,
          org_id,
          owner_user_id,
          media_type,
          branding_type,
          storage_bucket,
          storage_path,
          public_url,
          file_name,
          mime_type,
          file_size_bytes,
          title,
          caption,
          sort_order,
          is_primary,
          use_in_marketing,
          thumbnail_storage_path,
          thumbnail_url,
          created_at
        `)
        .order(
          'sort_order',
          {
            ascending: true,
          }
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

      if (listingId) {
        query = query.eq(
          'listing_id',
          listingId
        );
      } else {
        query = query.eq(
          'intake_session_id',
          intakeSessionId
        );
      }

      const {
        data,
        error: loadError,
      } = await query;

      if (loadError) {
        throw loadError;
      }

      setMediaRows(
        (data || []) as ListingMediaRow[]
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not load listing media.'
      );

      setMediaRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMedia();
  }, [intakeSessionId, listingId]);

  function nextSortOrder(
    mediaType: 'photo' | 'video'
  ) {
    const matching =
      mediaRows.filter(
        (media) =>
          media.media_type === mediaType
      );

    if (matching.length === 0) {
      return 0;
    }

    return (
      Math.max(
        ...matching.map(
          (media) =>
            media.sort_order
        )
      ) + 1
    );
  }

  async function uploadFiles(
    files: File[],
    mediaType: 'photo' | 'video',
    brandingType:
      | 'none'
      | 'branded'
      | 'unbranded'
  ) {
    if (files.length === 0) {
      return;
    }

    const photoLimit =
      20 * 1024 * 1024;

    const videoLimit =
      50 * 1024 * 1024;

    for (const file of files) {
      if (
        mediaType === 'photo' &&
        !isPhotoFile(file)
      ) {
        setError(
          `${file.name} is not a supported image file.`
        );

        return;
      }

      if (
        mediaType === 'video' &&
        !isVideoFile(file)
      ) {
        setError(
          `${file.name} is not a supported video file.`
        );

        return;
      }

      if (
        mediaType === 'photo' &&
        file.size > photoLimit
      ) {
        setError(
          `${file.name} is larger than 20 MB.`
        );

        return;
      }

      if (
        mediaType === 'video' &&
        file.size > videoLimit
      ) {
        setError(
          `${file.name} is larger than 50 MB. Use the YouTube/video URL field for larger videos.`
        );

        return;
      }
    }

    try {
      setUploading(true);
      setError(null);
      setNotice(null);

      const currentlyHasPrimary =
        mediaRows.some(
          (media) =>
            media.media_type ===
              'photo' &&
            media.is_primary
        );

      const startingOrder =
        nextSortOrder(mediaType);

      for (
        let index = 0;
        index < files.length;
        index += 1
      ) {
        const file = files[index];

        setProgressText(
          `Uploading ${index + 1} of ${files.length}: ${file.name}`
        );

        const mediaFolder =
          mediaType === 'photo'
            ? 'photos'
            : `videos/${brandingType}`;

        const uniquePart =
          typeof crypto !==
            'undefined' &&
          typeof crypto.randomUUID ===
            'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${index}`;

        const storagePath = [
          orgId,
          ownerUserId,
          intakeSessionId,
          mediaFolder,

          `${Date.now()}-${uniquePart}-${safeFileName(
            file.name
          )}`,
        ].join('/');

        const {
          error: uploadError,
        } = await supabase.storage
          .from('listing-media')
          .upload(
            storagePath,
            file,
            {
              cacheControl: '3600',
              upsert: false,

              contentType:
                file.type ||
                undefined,
            }
          );

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: publicUrlData,
        } = supabase.storage
          .from('listing-media')
          .getPublicUrl(storagePath);

        const shouldBePrimary =
          mediaType === 'photo' &&
          !currentlyHasPrimary &&
          index === 0;

        const {
          error: insertError,
        } = await supabase
          .from('listing_media')
          .insert({
            intake_session_id:
              intakeSessionId,

            listing_id:
              listingId || null,

            org_id:
              orgId,

            owner_user_id:
              ownerUserId,

            created_by:
              createdBy,

            media_type:
              mediaType,

            branding_type:
              mediaType === 'photo'
                ? 'none'
                : brandingType,

            storage_bucket:
              'listing-media',

            storage_path:
              storagePath,

            public_url:
              publicUrlData.publicUrl,

            file_name:
              file.name,

            mime_type:
              file.type || null,

            file_size_bytes:
              file.size,

            sort_order:
              startingOrder + index,

            is_primary:
              shouldBePrimary,

            use_in_marketing:
              true,

            title: null,
            caption: null,

            thumbnail_storage_path:
              null,

            thumbnail_url:
              null,
          });

        if (insertError) {
          await supabase.storage
            .from('listing-media')
            .remove([storagePath]);

          throw insertError;
        }
      }

      await loadMedia();

      setNotice(
        mediaType === 'photo'
          ? `${files.length} photo${
              files.length === 1
                ? ''
                : 's'
            } uploaded.`
          : `${files.length} ${
              brandingType
            } video${
              files.length === 1
                ? ''
                : 's'
            } uploaded.`
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'The media upload failed.'
      );
    } finally {
      setUploading(false);
      setProgressText(null);
    }
  }

  async function handlePhotoSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files || []
      );

    await uploadFiles(
      files,
      'photo',
      'none'
    );

    setPhotoInputKey(
      (current) =>
        current + 1
    );
  }

  async function handleBrandedVideoSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files || []
      );

    await uploadFiles(
      files,
      'video',
      'branded'
    );

    setBrandedVideoInputKey(
      (current) =>
        current + 1
    );
  }

  async function handleUnbrandedVideoSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files || []
      );

    await uploadFiles(
      files,
      'video',
      'unbranded'
    );

    setUnbrandedVideoInputKey(
      (current) =>
        current + 1
    );
  }

  async function savePhotoOrder(
    orderedPhotos: ListingMediaRow[]
  ) {
    for (
      let index = 0;
      index < orderedPhotos.length;
      index += 1
    ) {
      const photo =
        orderedPhotos[index];

      const {
        error: orderError,
      } = await supabase
        .from('listing_media')
        .update({
          sort_order: index,
        })
        .eq('id', photo.id);

      if (orderError) {
        throw orderError;
      }
    }
  }

  async function makePrimary(
    mediaId: string
  ) {
    const target =
      photos.find(
        (photo) =>
          photo.id === mediaId
      );

    if (!target) {
      return;
    }

    try {
      setWorkingId(mediaId);
      setError(null);
      setNotice(null);

      const {
        error: clearError,
      } = await supabase
        .from('listing_media')
        .update({
          is_primary: false,
        })
        .eq(
          'intake_session_id',
          intakeSessionId
        )
        .eq(
          'media_type',
          'photo'
        );

      if (clearError) {
        throw clearError;
      }

      const {
        error: primaryError,
      } = await supabase
        .from('listing_media')
        .update({
          is_primary: true,
          use_in_marketing: true,
        })
        .eq('id', mediaId);

      if (primaryError) {
        throw primaryError;
      }

      const orderedPhotos = [
        {
          ...target,
          is_primary: true,
          use_in_marketing: true,
        },

        ...photos
          .filter(
            (photo) =>
              photo.id !== mediaId
          )
          .map((photo) => ({
            ...photo,
            is_primary: false,
          })),
      ];

      await savePhotoOrder(
        orderedPhotos
      );

      await loadMedia();

      setSelectedPhotoId(mediaId);

      setNotice(
        'Primary photo updated and moved to position #1.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not update the primary photo.'
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function toggleMarketingPhoto(
    photo: ListingMediaRow
  ) {
    if (
      photo.is_primary &&
      photo.use_in_marketing
    ) {
      setNotice(
        'The primary photo must remain selected for marketing.'
      );

      return;
    }

    try {
      setWorkingId(photo.id);
      setError(null);
      setNotice(null);

      const nextValue =
        !photo.use_in_marketing;

      const {
        error: updateError,
      } = await supabase
        .from('listing_media')
        .update({
          use_in_marketing:
            nextValue,
        })
        .eq('id', photo.id);

      if (updateError) {
        throw updateError;
      }

      setMediaRows((current) =>
        current.map((media) =>
          media.id === photo.id
            ? {
                ...media,

                use_in_marketing:
                  nextValue,
              }
            : media
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not update the marketing selection.'
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function selectAllPhotos() {
    try {
      setWorkingId('select-all');
      setError(null);
      setNotice(null);

      const {
        error: updateError,
      } = await supabase
        .from('listing_media')
        .update({
          use_in_marketing: true,
        })
        .eq(
          'intake_session_id',
          intakeSessionId
        )
        .eq(
          'media_type',
          'photo'
        );

      if (updateError) {
        throw updateError;
      }

      await loadMedia();

      setNotice(
        'All photos selected for marketing.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not select all photos.'
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function clearMarketingPhotos() {
    const primaryPhoto =
      photos.find(
        (photo) =>
          photo.is_primary
      );

    try {
      setWorkingId('clear-all');
      setError(null);
      setNotice(null);

      let query = supabase
        .from('listing_media')
        .update({
          use_in_marketing: false,
        })
        .eq(
          'intake_session_id',
          intakeSessionId
        )
        .eq(
          'media_type',
          'photo'
        );

      if (primaryPhoto) {
        query = query.neq(
          'id',
          primaryPhoto.id
        );
      }

      const {
        error: updateError,
      } = await query;

      if (updateError) {
        throw updateError;
      }

      if (primaryPhoto) {
        const {
          error: primaryError,
        } = await supabase
          .from('listing_media')
          .update({
            use_in_marketing: true,
          })
          .eq(
            'id',
            primaryPhoto.id
          );

        if (primaryError) {
          throw primaryError;
        }
      }

      await loadMedia();

      setNotice(
        primaryPhoto
          ? 'Marketing selection cleared except for the required primary photo.'
          : 'Marketing selection cleared.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not clear the marketing selection.'
      );
    } finally {
      setWorkingId(null);
    }
  }

  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    photoId: string
  ) {
    setDraggedPhotoId(photoId);

    event.dataTransfer.effectAllowed =
      'move';

    event.dataTransfer.setData(
      'text/plain',
      photoId
    );
  }

  async function handleDrop(
    event: DragEvent<HTMLButtonElement>,
    targetPhotoId: string
  ) {
    event.preventDefault();

    const sourcePhotoId =
      draggedPhotoId ||
      event.dataTransfer.getData(
        'text/plain'
      );

    setDraggedPhotoId(null);

    if (
      !sourcePhotoId ||
      sourcePhotoId === targetPhotoId
    ) {
      return;
    }

    const sourceIndex =
      photos.findIndex(
        (photo) =>
          photo.id === sourcePhotoId
      );

    const targetIndex =
      photos.findIndex(
        (photo) =>
          photo.id === targetPhotoId
      );

    if (
      sourceIndex < 0 ||
      targetIndex < 0
    ) {
      return;
    }

    const reordered = [...photos];

    const [movedPhoto] =
      reordered.splice(
        sourceIndex,
        1
      );

    reordered.splice(
      targetIndex,
      0,
      movedPhoto
    );

    const primaryPhoto =
      reordered.find(
        (photo) =>
          photo.is_primary
      );

    const normalizedOrder =
      primaryPhoto
        ? [
            primaryPhoto,

            ...reordered.filter(
              (photo) =>
                photo.id !==
                primaryPhoto.id
            ),
          ]
        : reordered;

    try {
      setWorkingId('reorder');
      setError(null);
      setNotice(null);

      await savePhotoOrder(
        normalizedOrder
      );

      await loadMedia();

      setNotice(
        'Photo order updated.'
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not reorder the photos.'
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function updateMetadata(
    mediaId: string,
    patch: {
      title?: string | null;
      caption?: string | null;
    }
  ) {
    try {
      setWorkingId(mediaId);
      setError(null);

      const {
        error: updateError,
      } = await supabase
        .from('listing_media')
        .update(patch)
        .eq('id', mediaId);

      if (updateError) {
        throw updateError;
      }

      setMediaRows((current) =>
        current.map((media) =>
          media.id === mediaId
            ? {
                ...media,
                ...patch,
              }
            : media
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not update the media details.'
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteMedia(
    media: ListingMediaRow
  ) {
    const confirmed =
      window.confirm(
        `Remove ${media.file_name} from this listing?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setWorkingId(media.id);
      setError(null);
      setNotice(null);

      const remainingPhotos =
        photos.filter(
          (photo) =>
            photo.id !== media.id
        );

      const {
        error: deleteError,
      } = await supabase
        .from('listing_media')
        .delete()
        .eq('id', media.id);

      if (deleteError) {
        throw deleteError;
      }

      if (
        media.media_type === 'photo' &&
        media.is_primary &&
        remainingPhotos.length > 0
      ) {
        const nextPrimary =
          remainingPhotos[0];

        const {
          error: nextPrimaryError,
        } = await supabase
          .from('listing_media')
          .update({
            is_primary: true,
            use_in_marketing: true,
          })
          .eq(
            'id',
            nextPrimary.id
          );

        if (nextPrimaryError) {
          throw nextPrimaryError;
        }

        await savePhotoOrder(
          remainingPhotos.map(
            (photo, index) => ({
              ...photo,

              is_primary:
                index === 0,

              use_in_marketing:
                index === 0
                  ? true
                  : photo
                      .use_in_marketing,
            })
          )
        );
      }

      const {
        error: storageError,
      } = await supabase.storage
        .from(media.storage_bucket)
        .remove([
          media.storage_path,
        ]);

      if (
        selectedPhotoId === media.id
      ) {
        setSelectedPhotoId(null);
      }

      await loadMedia();

      if (storageError) {
        setNotice(
          'Media record removed. Supabase reported that the stored file may still need cleanup.'
        );
      } else {
        setNotice(
          'Media removed successfully.'
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not remove the media.'
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-violet-200 bg-violet-50/30 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Listing Photos and Videos
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Click a thumbnail for a larger preview. Drag
            thumbnails to reorder them. The primary photo
            always remains position #1.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="font-bold text-slate-900">
              {summary.photoCount}
            </div>

            <div className="text-slate-500">
              Photos
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="font-bold text-slate-900">
              {marketingPhotoCount}
            </div>

            <div className="text-slate-500">
              Marketing
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="font-bold text-slate-900">
              {summary.brandedVideoCount}
            </div>

            <div className="text-slate-500">
              Branded
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="font-bold text-slate-900">
              {summary.unbrandedVideoCount}
            </div>

            <div className="text-slate-500">
              Unbranded
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="font-bold text-slate-900">
              {summary.hasPrimaryPhoto
                ? 'Yes'
                : 'No'}
            </div>

            <div className="text-slate-500">
              Primary
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {notice}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {uploading && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />

          {progressText ||
            'Uploading media...'}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <label className="rounded-2xl border border-blue-200 bg-white p-4">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <ImagePlus className="h-5 w-5 text-blue-600" />
            Upload Photos
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Multiple JPG, PNG or WebP files. Maximum 20 MB
            each.
          </p>

          <input
            key={photoInputKey}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.gif,image/*"
            disabled={
              disabled ||
              uploading
            }
            onChange={handlePhotoSelection}
            className="mt-3 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
          />
        </label>

        <label className="rounded-2xl border border-orange-200 bg-white p-4">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Video className="h-5 w-5 text-orange-600" />
            Branded Video
          </div>

          <p className="mt-1 text-xs text-slate-500">
            MP4, MOV or WebM. Maximum 50 MB per file.
          </p>

          <input
            key={brandedVideoInputKey}
            type="file"
            multiple
            accept=".mp4,.mov,.webm,.m4v,video/*"
            disabled={
              disabled ||
              uploading
            }
            onChange={
              handleBrandedVideoSelection
            }
            className="mt-3 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-orange-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-orange-700"
          />
        </label>

        <label className="rounded-2xl border border-emerald-200 bg-white p-4">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Video className="h-5 w-5 text-emerald-600" />
            Unbranded Video
          </div>

          <p className="mt-1 text-xs text-slate-500">
            MP4, MOV or WebM. Maximum 50 MB per file.
          </p>

          <input
            key={unbrandedVideoInputKey}
            type="file"
            multiple
            accept=".mp4,.mov,.webm,.m4v,video/*"
            disabled={
              disabled ||
              uploading
            }
            onChange={
              handleUnbrandedVideoSelection
            }
            className="mt-3 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-100 file:px-3 py-2 file:text-sm file:font-semibold file:text-emerald-700"
          />
        </label>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() =>
            setPhotosOpen(
              (current) =>
                !current
            )
          }
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div>
            <div className="font-semibold text-slate-900">
              Photos
            </div>

            <div className="text-xs text-slate-500">
              {photos.length} stored ·{' '}
              {marketingPhotoCount} selected for marketing
            </div>
          </div>

          {photosOpen ? (
            <ChevronUp className="h-5 w-5 text-slate-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-500" />
          )}
        </button>

        {photosOpen && (
          <div className="border-t border-slate-200 p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllPhotos}
                disabled={
                  photos.length === 0 ||
                  workingId !== null
                }
                className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50"
              >
                Select All for Marketing
              </button>

              <button
                type="button"
                onClick={clearMarketingPhotos}
                disabled={
                  photos.length === 0 ||
                  workingId !== null
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Clear Marketing Selection
              </button>

              <div className="text-xs text-slate-500">
                Drag thumbnails to establish the display
                order.
              </div>
            </div>

            {loading && (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading photos...
              </div>
            )}

            {!loading &&
              photos.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                  <Upload className="mx-auto h-7 w-7 text-slate-400" />

                  <div className="mt-2 font-semibold text-slate-700">
                    No photos uploaded
                  </div>
                </div>
              )}

            {!loading &&
              photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                  {photos.map(
                    (photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        draggable
                        onDragStart={(
                          event
                        ) =>
                          handleDragStart(
                            event,
                            photo.id
                          )
                        }
                        onDragOver={(
                          event
                        ) =>
                          event.preventDefault()
                        }
                        onDrop={(
                          event
                        ) =>
                          handleDrop(
                            event,
                            photo.id
                          )
                        }
                        onDragEnd={() =>
                          setDraggedPhotoId(
                            null
                          )
                        }
                        onClick={() =>
                          setSelectedPhotoId(
                            photo.id
                          )
                        }
                        className={
                          draggedPhotoId ===
                          photo.id
                            ? 'group relative aspect-square overflow-hidden rounded-xl border-2 border-blue-500 bg-slate-100 opacity-50'
                            : photo.is_primary
                            ? 'group relative aspect-square overflow-hidden rounded-xl border-2 border-amber-400 bg-slate-100'
                            : photo.use_in_marketing
                            ? 'group relative aspect-square overflow-hidden rounded-xl border-2 border-emerald-400 bg-slate-100'
                            : 'group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 opacity-60'
                        }
                      >
                        <img
                          src={
                            photo.public_url
                          }
                          alt={
                            photo.caption ||
                            photo.file_name
                          }
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />

                        <div className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-slate-900/75 px-2 py-1 text-[10px] font-bold text-white">
                          <GripVertical className="h-3 w-3" />
                          {index + 1}
                        </div>

                        {photo.is_primary && (
                          <div className="absolute right-1.5 top-1.5 rounded-full bg-amber-400 p-1.5 text-amber-950 shadow">
                            <Star className="h-3.5 w-3.5 fill-current" />
                          </div>
                        )}

                        <div
                          className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 rounded-lg bg-slate-900/75 px-2 py-1 text-[10px] font-semibold text-white"
                          onClick={(
                            event
                          ) =>
                            event.stopPropagation()
                          }
                        >
                          <span>
                            Use
                          </span>

                          <input
                            type="checkbox"
                            aria-label={`Use ${photo.file_name} in marketing`}
                            checked={
                              photo
                                .use_in_marketing
                            }
                            disabled={
                              photo.is_primary ||
                              workingId !==
                                null
                            }
                            onChange={() =>
                              toggleMarketingPhoto(
                                photo
                              )
                            }
                            className="h-4 w-4"
                          />
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}
          </div>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() =>
            setVideosOpen(
              (current) =>
                !current
            )
          }
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div>
            <div className="font-semibold text-slate-900">
              Videos
            </div>

            <div className="text-xs text-slate-500">
              {videos.length} uploaded
            </div>
          </div>

          {videosOpen ? (
            <ChevronUp className="h-5 w-5 text-slate-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-500" />
          )}
        </button>

        {videosOpen && (
          <div className="border-t border-slate-200 p-4">
            {videos.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                No direct video files uploaded.
              </div>
            ) : (
              <div className="space-y-3">
                {videos.map(
                  (video) => (
                    <article
                      key={video.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"
                    >
                      <video
                        controls
                        preload="metadata"
                        src={
                          video.public_url
                        }
                        className="aspect-video w-full rounded-lg bg-black object-contain sm:w-48"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-900">
                          {video.file_name}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {formatBytes(
                            video.file_size_bytes
                          )}
                          {' · '}

                          {video.branding_type ===
                          'branded'
                            ? 'Branded'
                            : 'Unbranded'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deleteMedia(video)
                        }
                        disabled={
                          workingId !== null
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </article>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() =>
            setSelectedPhotoId(null)
          }
        >
          <div
            className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="font-semibold text-slate-900">
                  Photo #{photos.findIndex(
                    (photo) =>
                      photo.id ===
                      selectedPhoto.id
                  ) + 1}
                </div>

                <div className="text-xs text-slate-500">
                  {selectedPhoto.file_name}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedPhotoId(null)
                }
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
              <div className="overflow-hidden rounded-2xl bg-slate-100">
                <img
                  src={
                    selectedPhoto.public_url
                  }
                  alt={
                    selectedPhoto.caption ||
                    selectedPhoto.file_name
                  }
                  className="max-h-[70vh] w-full object-contain"
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div>
                    {formatBytes(
                      selectedPhoto
                        .file_size_bytes
                    )}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {selectedPhoto.is_primary
                      ? 'Primary photo · Position #1'
                      : selectedPhoto
                          .use_in_marketing
                      ? 'Selected for marketing'
                      : 'Stored but excluded from marketing'}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Photo Title
                  </span>

                  <input
                    value={
                      selectedPhoto.title ||
                      ''
                    }
                    onChange={(event) =>
                      setMediaRows(
                        (current) =>
                          current.map(
                            (media) =>
                              media.id ===
                              selectedPhoto.id
                                ? {
                                    ...media,

                                    title:
                                      event
                                        .target
                                        .value,
                                  }
                                : media
                          )
                      )
                    }
                    onBlur={(event) =>
                      updateMetadata(
                        selectedPhoto.id,
                        {
                          title:
                            event.target
                              .value
                              .trim() ||
                            null,
                        }
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Caption
                  </span>

                  <textarea
                    value={
                      selectedPhoto.caption ||
                      ''
                    }
                    rows={4}
                    onChange={(event) =>
                      setMediaRows(
                        (current) =>
                          current.map(
                            (media) =>
                              media.id ===
                              selectedPhoto.id
                                ? {
                                    ...media,

                                    caption:
                                      event
                                        .target
                                        .value,
                                  }
                                : media
                          )
                      )
                    }
                    onBlur={(event) =>
                      updateMetadata(
                        selectedPhoto.id,
                        {
                          caption:
                            event.target
                              .value
                              .trim() ||
                            null,
                        }
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                  <span>
                    Use in Marketing
                  </span>

                  <input
                    type="checkbox"
                    checked={
                      selectedPhoto
                        .use_in_marketing
                    }
                    disabled={
                      selectedPhoto.is_primary ||
                      workingId !== null
                    }
                    onChange={() =>
                      toggleMarketingPhoto(
                        selectedPhoto
                      )
                    }
                    className="h-5 w-5"
                  />
                </label>

                {!selectedPhoto.is_primary && (
                  <button
                    type="button"
                    onClick={() =>
                      makePrimary(
                        selectedPhoto.id
                      )
                    }
                    disabled={
                      workingId !== null
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-amber-950"
                  >
                    <Star className="h-4 w-4" />
                    Make Primary and Move to #1
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    deleteMedia(
                      selectedPhoto
                    )
                  }
                  disabled={
                    workingId !== null
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
