"use client";

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

type Photo = {
  id: string;
  public_url: string;
  title:
    | string
    | null;
  caption:
    | string
    | null;
  primary_category:
    | string
    | null;
  room_label:
    | string
    | null;
  visual_summary:
    | string
    | null;
};

type Props = {
  photos: Photo[];
  accent: string;
  propertyAddress: string;
};

function normalizeIndex(
  index: number,
  length: number
) {
  if (length <= 0) {
    return 0;
  }

  return (
    (index % length) +
    length
  ) % length;
}

function circularDistance(
  index: number,
  activeIndex: number,
  length: number
) {
  if (length <= 0) {
    return 0;
  }

  const forward =
    normalizeIndex(
      index - activeIndex,
      length
    );

  return forward >
    length / 2
    ? forward - length
    : forward;
}

function positionClass(
  distance: number
) {
  if (distance <= -2) {
    return "left-[-16%] sm:left-[-6%] lg:left-[7%]";
  }

  if (distance === -1) {
    return "left-[7%] sm:left-[18%] lg:left-[24%]";
  }

  if (distance === 1) {
    return "left-[93%] sm:left-[82%] lg:left-[76%]";
  }

  if (distance >= 2) {
    return "left-[116%] sm:left-[106%] lg:left-[93%]";
  }

  return "left-1/2";
}

function formatPhotoCategory(
  value:
    | string
    | null
) {
  return String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function capitalizeFirstCharacter(
  value: string
) {
  const text = value.trim();

  if (!text) {
    return "";
  }

  return (
    text.charAt(0).toLocaleUpperCase() +
    text.slice(1)
  );
}

function photoDisplayLabel(
  photo: Photo,
  index: number,
  propertyAddress: string
) {
  const label =
    photo.room_label?.trim() ||
    formatPhotoCategory(
      photo.primary_category
    ) ||
    photo.title?.trim() ||
    photo.caption?.trim() ||
    photo.visual_summary?.trim() ||
    `${propertyAddress} photo ${
      index + 1
    }`;

  return capitalizeFirstCharacter(
    label
  );
}

export default function PropertyGalleryCarousel({
  photos,
  accent,
  propertyAddress,
}: Props) {
  const [
    activeIndex,
    setActiveIndex,
  ] = useState(0);

  const [
    lightboxIndex,
    setLightboxIndex,
  ] = useState<number | null>(
    null
  );

  const galleryStageRef =
    useRef<HTMLDivElement>(
      null
    );

  const stagePressedPhotoIndexRef =
    useRef<number | null>(
      null
    );

  const stagePointerIdRef =
    useRef<number | null>(null);

  const stageStartXRef =
    useRef<number | null>(null);

  const stageStartYRef =
    useRef<number | null>(null);

  const suppressStageClickUntilRef =
    useRef(0);

  const lastWheelNavigationRef =
    useRef(0);

  const lightboxPointerIdRef =
    useRef<number | null>(null);

  const lightboxStartXRef =
    useRef<number | null>(null);

  const lightboxStartYRef =
    useRef<number | null>(null);

  const suppressBackdropClickUntilRef =
    useRef(0);

  useEffect(() => {
    setActiveIndex((current) =>
      normalizeIndex(
        current,
        photos.length
      )
    );

    setLightboxIndex(
      (current) => {
        if (
          current === null ||
          photos.length <= 0
        ) {
          return photos.length <= 0
            ? null
            : current;
        }

        return normalizeIndex(
          current,
          photos.length
        );
      }
    );
  }, [photos.length]);

  useEffect(() => {
    if (
      lightboxIndex ===
      null
    ) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        closeLightbox();
        return;
      }

      if (
        event.key ===
        "ArrowLeft"
      ) {
        event.preventDefault();
        moveLightbox(-1);
        return;
      }

      if (
        event.key ===
        "ArrowRight"
      ) {
        event.preventDefault();
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
    lightboxIndex,
    photos.length,
  ]);

  useEffect(() => {
    const galleryStage =
      galleryStageRef.current;

    if (
      !galleryStage ||
      photos.length <= 1
    ) {
      return;
    }

    function handleWheel(
      event: WheelEvent
    ) {
      const movement =
        Math.abs(event.deltaX) >=
        Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;

      if (
        Math.abs(movement) <
        1
      ) {
        return;
      }

      event.preventDefault();

      if (
        Math.abs(movement) <
        10
      ) {
        return;
      }

      const now = Date.now();

      if (
        now -
          lastWheelNavigationRef.current <
        350
      ) {
        return;
      }

      lastWheelNavigationRef.current =
        now;

      setActiveIndex(
        (current) =>
          normalizeIndex(
            current +
              (
                movement > 0
                  ? 1
                  : -1
              ),
            photos.length
          )
      );
    }

    galleryStage.addEventListener(
      "wheel",
      handleWheel,
      {
        passive: false,
      }
    );

    return () => {
      galleryStage.removeEventListener(
        "wheel",
        handleWheel
      );
    };
  }, [photos.length]);

  if (photos.length === 0) {
    return null;
  }

  const activePhoto =
    photos[activeIndex] ||
    photos[0];

  if (!activePhoto) {
    return null;
  }

  const activePhotoLabel =
    photoDisplayLabel(
      activePhoto,
      activeIndex,
      propertyAddress
    );

  const activeLightboxPhoto =
    lightboxIndex === null
      ? null
      : photos[
          lightboxIndex
        ] || null;

  const visiblePhotos =
    photos
      .map(
        (
          photo,
          index
        ) => ({
          photo,
          index,
          distance:
            circularDistance(
              index,
              activeIndex,
              photos.length
            ),
        })
      )
      .filter(
        ({ distance }) =>
          Math.abs(distance) <= 2
      );

  function moveGallery(
    direction: number
  ) {
    setActiveIndex(
      (current) =>
        normalizeIndex(
          current + direction,
          photos.length
        )
    );
  }

  function openLightbox(
    index: number
  ) {
    const normalized =
      normalizeIndex(
        index,
        photos.length
      );

    setActiveIndex(normalized);
    setLightboxIndex(normalized);
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function moveLightbox(
    direction: number
  ) {
    if (
      lightboxIndex === null
    ) {
      return;
    }

    const nextIndex =
      normalizeIndex(
        lightboxIndex +
          direction,
        photos.length
      );

    setActiveIndex(nextIndex);
    setLightboxIndex(nextIndex);
  }

  function resetStagePointer() {
    stagePointerIdRef.current =
      null;

    stageStartXRef.current =
      null;

    stageStartYRef.current =
      null;

    stagePressedPhotoIndexRef.current =
      null;
  }

  function handleStagePointerDown(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    if (
      event.pointerType ===
        "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    const target =
      event.target;

    const photoButton =
      target instanceof Element
        ? target.closest<HTMLButtonElement>(
            "[data-gallery-photo-index]"
          )
        : null;

    const pressedPhotoIndex =
      Number(
        photoButton?.dataset
          .galleryPhotoIndex
      );

    stagePressedPhotoIndexRef.current =
      Number.isInteger(
        pressedPhotoIndex
      )
        ? pressedPhotoIndex
        : null;

    stagePointerIdRef.current =
      event.pointerId;

    stageStartXRef.current =
      event.clientX;

    stageStartYRef.current =
      event.clientY;

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  }

  function handleStagePointerUp(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    if (
      stagePointerIdRef.current !==
        event.pointerId ||
      stageStartXRef.current ===
        null ||
      stageStartYRef.current ===
        null
    ) {
      resetStagePointer();
      return;
    }

    const horizontalDistance =
      event.clientX -
      stageStartXRef.current;

    const verticalDistance =
      event.clientY -
      stageStartYRef.current;

    const isHorizontalSwipe =
      Math.abs(
        horizontalDistance
      ) >= 45 &&
      Math.abs(
        horizontalDistance
      ) >
        Math.abs(
          verticalDistance
        ) *
          1.15;

    const isStationaryClick =
      Math.abs(
        horizontalDistance
      ) < 12 &&
      Math.abs(
        verticalDistance
      ) < 12;

    if (isHorizontalSwipe) {
      suppressStageClickUntilRef.current =
        Date.now() + 350;

      moveGallery(
        horizontalDistance > 0
          ? -1
          : 1
      );
    }
    else if (
      isStationaryClick &&
      stagePressedPhotoIndexRef.current !==
        null
    ) {
      const pressedIndex =
        normalizeIndex(
          stagePressedPhotoIndexRef.current,
          photos.length
        );

      if (
        pressedIndex ===
        activeIndex
      ) {
        openLightbox(
          pressedIndex
        );
      }
      else {
        setActiveIndex(
          pressedIndex
        );
      }
    }

    resetStagePointer();
  }

  function handleStageKeyDown(
    event:
      ReactKeyboardEvent<HTMLDivElement>
  ) {
    if (
      event.key ===
      "ArrowLeft"
    ) {
      event.preventDefault();
      moveGallery(-1);
      return;
    }

    if (
      event.key ===
      "ArrowRight"
    ) {
      event.preventDefault();
      moveGallery(1);
      return;
    }

    if (
      event.key ===
        "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openLightbox(
        activeIndex
      );
    }
  }

  function resetLightboxPointer() {
    lightboxPointerIdRef.current =
      null;

    lightboxStartXRef.current =
      null;

    lightboxStartYRef.current =
      null;
  }

  function handleLightboxPointerDown(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    if (
      event.pointerType ===
        "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    lightboxPointerIdRef.current =
      event.pointerId;

    lightboxStartXRef.current =
      event.clientX;

    lightboxStartYRef.current =
      event.clientY;

    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  }

  function handleLightboxPointerUp(
    event:
      ReactPointerEvent<HTMLDivElement>
  ) {
    if (
      lightboxPointerIdRef.current !==
        event.pointerId ||
      lightboxStartXRef.current ===
        null ||
      lightboxStartYRef.current ===
        null
    ) {
      resetLightboxPointer();
      return;
    }

    const horizontalDistance =
      event.clientX -
      lightboxStartXRef.current;

    const verticalDistance =
      event.clientY -
      lightboxStartYRef.current;

    if (
      Math.abs(
        horizontalDistance
      ) >= 45 &&
      Math.abs(
        horizontalDistance
      ) >
        Math.abs(
          verticalDistance
        ) *
          1.15
    ) {
      suppressBackdropClickUntilRef.current =
        Date.now() + 350;

      moveLightbox(
        horizontalDistance > 0
          ? -1
          : 1
      );
    }

    resetLightboxPointer();
  }

  return (
    <section
      id="gallery"
      className="scroll-mt-8 overflow-hidden border-y border-white/10 bg-white/[0.025]"
    >
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.28em]"
              style={{
                color: accent,
              }}
            >
              Property Gallery
            </p>

            <h2 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
              Explore every detail
            </h2>
          </div>

          <div className="text-sm text-white/55">
            {photos.length} professionally selected photographs
          </div>
        </div>

        <div
            ref={galleryStageRef}
          role="region"
          aria-label="Property photo carousel"
          aria-roledescription="carousel"
          tabIndex={0}
          onKeyDown={
            handleStageKeyDown
          }
          onPointerDown={
            handleStagePointerDown
          }
          onPointerUp={
            handleStagePointerUp
          }
          onPointerCancel={
            resetStagePointer
          }
          className="relative mt-10 h-[24rem] touch-pan-y select-none overflow-hidden outline-none [perspective:1600px] focus-visible:ring-2 focus-visible:ring-white/50 sm:h-[31rem] lg:h-[38rem]"
        >
          {visiblePhotos.map(
            ({
              photo,
              index,
              distance,
            }) => {
              const absoluteDistance =
                Math.abs(
                  distance
                );

              const scale =
                absoluteDistance === 0
                  ? 1
                  : absoluteDistance === 1
                    ? 0.78
                    : 0.62;

              const opacity =
                absoluteDistance === 0
                  ? 1
                  : absoluteDistance === 1
                    ? 0.74
                    : 0.36;

              const rotation =
                distance === 0
                  ? 0
                  : distance < 0
                    ? 18
                    : -18;

              const depth =
                absoluteDistance === 0
                  ? 70
                  : absoluteDistance === 1
                    ? 25
                    : -25;

              const zIndex =
                absoluteDistance === 0
                  ? 50
                  : absoluteDistance === 1
                    ? 30
                    : 10;

              const isActive =
                distance === 0;

              const label =
                photoDisplayLabel(
                  photo,
                  index,
                  propertyAddress
                );

              return (
                <button
                  key={photo.id}
                  type="button"
                    data-gallery-photo-index={index}
                    onClick={(event) => {
                      if (
                        event.detail !== 0 ||
                        Date.now() <
                          suppressStageClickUntilRef.current
                      ) {
                        return;
                      }

                      if (isActive) {
                        openLightbox(
                          index
                        );
                      }
                      else {
                        setActiveIndex(
                          index
                        );
                      }
                    }}
                  aria-label={
                    isActive
                      ? `Enlarge ${label}`
                      : `Make ${label} the active photo`
                  }
                  aria-current={
                    isActive
                      ? "true"
                      : undefined
                  }
                  className={`absolute top-1/2 w-[82%] overflow-hidden rounded-[1.75rem] border bg-black text-left shadow-2xl transition-all duration-500 ease-out sm:w-[70%] lg:w-[58%] ${positionClass(
                    distance
                  )}`}
                  style={{
                    borderColor:
                      isActive
                        ? accent
                        : "rgba(255,255,255,0.12)",

                    opacity,

                    zIndex,

                    filter:
                      isActive
                        ? "brightness(1)"
                        : absoluteDistance ===
                            1
                          ? "brightness(0.68)"
                          : "brightness(0.42)",

                    transform:
                      `translate3d(-50%, -50%, ${depth}px) scale(${scale}) rotateY(${rotation}deg)`,
                  }}
                >
                  <img
                    src={
                      photo.public_url
                    }
                    alt={label}
                    draggable={false}
                    loading={
                      index < 3
                        ? "eager"
                        : "lazy"
                    }
                    className="aspect-[4/3] w-full object-cover"
                  />

                  <div
                    className={`absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/5 transition ${
                      isActive
                        ? "opacity-100"
                        : "opacity-40"
                    }`}
                  />

                  {isActive && (
                    <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                      <Maximize2 className="h-4 w-4" />
                      View larger
                    </span>
                  )}
                </button>
              );
            }
          )}

          {photos.length > 1 && (
            <>
              <button
                type="button"
                data-gallery-arrow
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onPointerUp={(event) => {
                  event.stopPropagation();
                }}
                onPointerCancel={(event) => {
                  event.stopPropagation();
                }}
                onClick={() =>
                  moveGallery(-1)
                }
                aria-label="Previous property photo"
                className="absolute left-2 top-1/2 z-[70] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur transition hover:bg-white/15 sm:left-5 sm:h-14 sm:w-14"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <button
                type="button"
                data-gallery-arrow
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onPointerUp={(event) => {
                  event.stopPropagation();
                }}
                onPointerCancel={(event) => {
                  event.stopPropagation();
                }}
                onClick={() =>
                  moveGallery(1)
                }
                aria-label="Next property photo"
                className="absolute right-2 top-1/2 z-[70] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur transition hover:bg-white/15 sm:right-5 sm:h-14 sm:w-14"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        <div
          aria-live="polite"
          className="mx-auto -mt-2 flex max-w-3xl flex-col items-center text-center sm:-mt-4"
        >
          <div className="text-base font-semibold text-white sm:text-lg">
            {activePhotoLabel}
          </div>

          <div className="mt-2 flex items-center gap-3 text-sm text-white/55">
            <span>
              {activeIndex + 1} of{" "}
              {photos.length}
            </span>

            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor:
                  accent,
              }}
            />

            <span>
              Swipe, scroll, or use the arrows
            </span>
          </div>
        </div>
      </div>

      {activeLightboxPhoto &&
        lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged property photo ${
            lightboxIndex + 1
          }`}
          onClick={(event) => {
            if (
              Date.now() <
              suppressBackdropClickUntilRef.current
            ) {
              return;
            }

            if (
              event.target ===
              event.currentTarget
            ) {
              closeLightbox();
            }
          }}
          onPointerDown={
            handleLightboxPointerDown
          }
          onPointerUp={
            handleLightboxPointerUp
          }
          onPointerCancel={
            resetLightboxPointer
          }
          className="fixed inset-0 z-[120] flex touch-none items-center justify-center bg-black/95 p-3 backdrop-blur-md sm:p-8"
        >
          <button
            type="button"
            data-lightbox-control
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
            }}
            onClick={closeLightbox}
            aria-label="Return to property gallery"
            className="absolute left-3 top-3 z-20 inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 text-sm font-semibold text-white transition hover:bg-white/15 sm:left-6 sm:top-6"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Return to Gallery</span>
          </button>

          <button
            type="button"
            data-lightbox-control
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
            }}
            onClick={
              closeLightbox
            }
            aria-label="Close property photo"
            className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition hover:bg-white/15 sm:right-6 sm:top-6"
          >
            <X className="h-6 w-6" />
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              data-lightbox-control
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
              }}
              onPointerCancel={(event) => {
                event.stopPropagation();
              }}
              onClick={() =>
                moveLightbox(-1)
              }
              aria-label="Previous enlarged property photo"
              className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition hover:bg-white/15 sm:left-6 sm:h-14 sm:w-14"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <div className="flex max-h-full w-full max-w-7xl flex-col items-center justify-center px-9 sm:px-16">
            <img
              src={
                activeLightboxPhoto
                  .public_url
              }
              alt={
                photoDisplayLabel(
                  activeLightboxPhoto,
                  lightboxIndex,
                  propertyAddress
                )
              }
              draggable={false}
              className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />

            <div
              aria-live="polite"
              className="mt-4 text-center"
            >
              <div className="text-base font-semibold text-white sm:text-lg">
                {photoDisplayLabel(
                  activeLightboxPhoto,
                  lightboxIndex,
                  propertyAddress
                )}
              </div>

              <div className="mt-1 text-sm text-white/55">
                {lightboxIndex + 1} of{" "}
                {photos.length}
                {" · "}
                Swipe or use the arrows
              </div>
            </div>
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              data-lightbox-control
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
              }}
              onPointerCancel={(event) => {
                event.stopPropagation();
              }}
              onClick={() =>
                moveLightbox(1)
              }
              aria-label="Next enlarged property photo"
              className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition hover:bg-white/15 sm:right-6 sm:h-14 sm:w-14"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
