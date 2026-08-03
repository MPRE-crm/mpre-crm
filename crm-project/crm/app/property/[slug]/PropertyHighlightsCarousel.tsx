"use client";

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Highlight = {
  id: string;
  photo_media_id:
    | string
    | null;
  headline: string;
  summary: string;
  bullet_points: unknown;
};

type Photo = {
  id: string;
  public_url: string;
};

type Props = {
  highlights: Highlight[];
  photos: Photo[];
  accent: string;
  propertyAddress: string;
};

function normalizeStringArray(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      String(item || "").trim()
    )
    .filter(Boolean);
}

export default function PropertyHighlightsCarousel({
  highlights,
  photos,
  accent,
  propertyAddress,
}: Props) {
  const carouselRef =
    useRef<HTMLDivElement>(
      null
    );

  const [
    pageOffsets,
    setPageOffsets,
  ] = useState<number[]>([0]);

  const [
    activePage,
    setActivePage,
  ] = useState(0);

  const lightboxItems =
    highlights
      .map((highlight) => {
        const photo =
          highlight
            .photo_media_id
            ? photos.find(
                (candidate) =>
                  candidate.id ===
                  highlight
                    .photo_media_id
              ) || null
            : null;

        return photo
          ? {
              highlight,
              photo,
            }
          : null;
      })
      .filter(
        (
          item
        ): item is {
          highlight: Highlight;
          photo: Photo;
        } => item !== null
      );

  const [
    activeLightboxIndex,
    setActiveLightboxIndex,
  ] = useState<number | null>(
    null
  );

  useEffect(() => {
    const carouselElement =
      carouselRef.current;

    if (!carouselElement) {
      return;
    }

    const carousel =
      carouselElement;

    function calculatePages() {
      const cards =
        Array.from(
          carousel.querySelectorAll<HTMLElement>(
            "[data-highlight-card]"
          )
        );

      if (cards.length === 0) {
        setPageOffsets([0]);
        setActivePage(0);
        return;
      }

      const styles =
        window.getComputedStyle(
          carousel
        );

      const gap =
        Number.parseFloat(
          styles.columnGap ||
            styles.gap ||
            "0"
        ) || 0;

      const cardWidth =
        cards[0].offsetWidth;

      const visibleCount =
        Math.max(
          1,
          Math.round(
            (carousel.clientWidth +
              gap) /
              (cardWidth + gap)
          )
        );

      const offsets: number[] =
        [];

      for (
        let index = 0;
        index < cards.length;
        index += visibleCount
      ) {
        offsets.push(
          cards[index].offsetLeft
        );
      }

      setPageOffsets(
        offsets.length > 0
          ? offsets
          : [0]
      );

      setActivePage((current) =>
        Math.min(
          current,
          Math.max(
            0,
            offsets.length - 1
          )
        )
      );
    }

    calculatePages();

    const resizeObserver =
      new ResizeObserver(
        calculatePages
      );

    resizeObserver.observe(
      carousel
    );

    return () => {
      resizeObserver.disconnect();
    };
  }, [highlights.length]);

  useEffect(() => {
    if (
      activeLightboxIndex ===
      null
    ) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        closeLightbox();
        return;
      }

      if (
        event.key ===
        "ArrowLeft"
      ) {
        moveLightbox(-1);
      }

      if (
        event.key ===
        "ArrowRight"
      ) {
        moveLightbox(1);
      }
    }

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    activeLightboxIndex,
    lightboxItems.length,
  ]);

  const updateActivePage =
    useCallback(() => {
      const carousel =
        carouselRef.current;

      if (!carousel) {
        return;
      }

      let nearestPage = 0;
      let nearestDistance =
        Number.POSITIVE_INFINITY;

      pageOffsets.forEach(
        (offset, index) => {
          const distance =
            Math.abs(
              carousel.scrollLeft -
                offset
            );

          if (
            distance <
            nearestDistance
          ) {
            nearestDistance =
              distance;
            nearestPage = index;
          }
        }
      );

      setActivePage(
        nearestPage
      );
    }, [pageOffsets]);

  function scrollToPage(
    requestedPage: number
  ) {
    const carousel =
      carouselRef.current;

    if (!carousel) {
      return;
    }

    const page =
      Math.max(
        0,
        Math.min(
          requestedPage,
          pageOffsets.length - 1
        )
      );

    carousel.scrollTo({
      left: pageOffsets[page] || 0,
      behavior: "smooth",
    });

    setActivePage(page);
  }

  function openLightbox(
    highlightId: string
  ) {
    const itemIndex =
      lightboxItems.findIndex(
        (item) =>
          item.highlight.id ===
          highlightId
      );

    if (itemIndex >= 0) {
      setActiveLightboxIndex(
        itemIndex
      );
    }
  }

  function closeLightbox() {
    setActiveLightboxIndex(
      null
    );
  }

  function moveLightbox(
    direction: number
  ) {
    if (
      lightboxItems.length ===
      0
    ) {
      return;
    }

    setActiveLightboxIndex(
      (current) => {
        if (current === null) {
          return null;
        }

        return (
          current +
          direction +
          lightboxItems.length
        ) % lightboxItems.length;
      }
    );
  }

  const activeLightboxItem =
    activeLightboxIndex ===
    null
      ? null
      : lightboxItems[
          activeLightboxIndex
        ] || null;

  return (
    <section className="border-y border-white/10 bg-white/[0.035]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p
              className="text-xs font-bold uppercase tracking-[0.28em]"
              style={{
                color: accent,
              }}
            >
              Property Highlights
            </p>

            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">
              Designed for elevated everyday living
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                scrollToPage(
                  activePage - 1
                )
              }
              disabled={
                activePage === 0
              }
              aria-label="Previous property highlights"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() =>
                scrollToPage(
                  activePage + 1
                )
              }
              disabled={
                activePage ===
                pageOffsets.length - 1
              }
              aria-label="Next property highlights"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          ref={carouselRef}
          onScroll={
            updateActivePage
          }
          className="relative mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {highlights.map(
            (highlight) => {
              const photo =
                highlight
                  .photo_media_id
                  ? photos.find(
                      (candidate) =>
                        candidate.id ===
                        highlight
                          .photo_media_id
                    ) || null
                  : null;

              const bulletPoints =
                normalizeStringArray(
                  highlight
                    .bullet_points
                );

              return (
                <article
                  key={highlight.id}
                  data-highlight-card
                  className="flex w-full shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/20 shadow-xl sm:w-[calc((100%_-_1.5rem)/2)] lg:w-[calc((100%_-_3rem)/3)]"
                >
                  {photo ? (
                    <button
                      type="button"
                      onClick={() =>
                        openLightbox(
                          highlight.id
                        )
                      }
                      aria-label={`Enlarge ${highlight.headline} photo`}
                      className="group relative block w-full cursor-zoom-in overflow-hidden text-left"
                    >
                      <img
                        src={
                          photo.public_url
                        }
                        alt={`${highlight.headline} at ${propertyAddress}`}
                        className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />

                      <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs font-semibold text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                        <Maximize2 className="h-4 w-4" />
                        View larger
                      </span>
                    </button>
                  ) : null}

                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-xl font-semibold text-white">
                      {
                        highlight
                          .headline
                      }
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-white/70">
                      {
                        highlight
                          .summary
                      }
                    </p>

                    {bulletPoints.length >
                      0 && (
                      <ul className="mt-5 space-y-3">
                        {bulletPoints.map(
                          (
                            bullet,
                            index
                          ) => (
                            <li
                              key={`${highlight.id}-${index}`}
                              className="flex items-start gap-3 text-sm leading-6 text-white/80"
                            >
                              <span
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{
                                  backgroundColor:
                                    accent,
                                }}
                              >
                                ✓
                              </span>

                              <span>
                                {bullet}
                              </span>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </div>
                </article>
              );
            }
          )}
        </div>

        {pageOffsets.length > 1 && (
          <div className="mt-5 flex items-center justify-center gap-2">
            {pageOffsets.map(
              (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    scrollToPage(
                      index
                    )
                  }
                  aria-label={`Show property highlights page ${index + 1}`}
                  aria-current={
                    index === activePage
                      ? "true"
                      : undefined
                  }
                  className={`h-2.5 rounded-full transition-all ${
                    index === activePage
                      ? "w-8"
                      : "w-2.5 bg-white/25 hover:bg-white/40"
                  }`}
                  style={
                    index === activePage
                      ? {
                          backgroundColor:
                            accent,
                        }
                      : undefined
                  }
                />
              )
            )}
          </div>
        )}
      </div>

      {activeLightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeLightboxItem.highlight.headline} enlarged photo`}
          onClick={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeLightbox();
            }
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close enlarged photo"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition hover:bg-white/15 sm:right-6 sm:top-6"
          >
            <X className="h-6 w-6" />
          </button>

          {lightboxItems.length >
            1 && (
            <button
              type="button"
              onClick={() =>
                moveLightbox(-1)
              }
              aria-label="Previous enlarged highlight photo"
              className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition hover:bg-white/15 sm:left-6"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <div className="flex max-h-full w-full max-w-6xl flex-col items-center justify-center px-10 sm:px-16">
            <img
              src={
                activeLightboxItem
                  .photo.public_url
              }
              alt={`${activeLightboxItem.highlight.headline} at ${propertyAddress}`}
              className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />

            <div
              aria-live="polite"
              className="mt-4 text-center"
            >
              <div className="text-lg font-semibold text-white">
                {
                  activeLightboxItem
                    .highlight.headline
                }
              </div>

              <div className="mt-1 text-sm text-white/60">
                {propertyAddress}
                {" · "}
                {
                  (
                    activeLightboxIndex ||
                    0
                  ) + 1
                }
                {" of "}
                {lightboxItems.length}
              </div>
            </div>
          </div>

          {lightboxItems.length >
            1 && (
            <button
              type="button"
              onClick={() =>
                moveLightbox(1)
              }
              aria-label="Next enlarged highlight photo"
              className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition hover:bg-white/15 sm:right-6"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
