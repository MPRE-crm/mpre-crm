"use client";

import {
  useEffect,
  useRef,
} from "react";

type EngagementEventType =
  | "page_view"
  | "video_play"
  | "video_progress_25"
  | "video_progress_50"
  | "video_progress_75"
  | "video_complete"
  | "video_external_click"
  | "virtual_tour_click"
  | "showing_request_click"
  | "phone_click"
  | "email_click";

type PropertyEngagementTrackerProps = {
  listingId: string;
  slug: string;
  youtubeIframeId?: string;
};

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy?: () => void;
};

type YouTubeStateEvent = {
  data: number;
  target: YouTubePlayer;
};

type YouTubeApi = {
  Player: new (
    elementId: string,
    options: {
      events: {
        onStateChange: (
          event: YouTubeStateEvent
        ) => void;
      };
    }
  ) => YouTubePlayer;

  PlayerState: {
    PLAYING: number;
    ENDED: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?:
      () => void;
  }
}

const VISITOR_STORAGE_KEY =
  "easyrealtor_property_visitor_id_v1";

const SESSION_STORAGE_KEY =
  "easyrealtor_property_session_id_v1";

const YOUTUBE_SCRIPT_ID =
  "youtube-iframe-api";

const EVENT_TYPES =
  new Set<EngagementEventType>([
    "page_view",
    "video_play",
    "video_progress_25",
    "video_progress_50",
    "video_progress_75",
    "video_complete",
    "video_external_click",
    "virtual_tour_click",
    "showing_request_click",
    "phone_click",
    "email_click",
  ]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let youtubeApiPromise:
  | Promise<YouTubeApi>
  | null =
  null;

function createUuid() {
  if (
    typeof window.crypto
      ?.randomUUID ===
    "function"
  ) {
    return window.crypto
      .randomUUID();
  }

  if (
    typeof window.crypto
      ?.getRandomValues ===
    "function"
  ) {
    const bytes =
      new Uint8Array(16);

    window.crypto
      .getRandomValues(
        bytes
      );

    bytes[6] =
      (bytes[6] & 0x0f) |
      0x40;

    bytes[8] =
      (bytes[8] & 0x3f) |
      0x80;

    const hex =
      Array.from(
        bytes,
        (value) =>
          value
            .toString(16)
            .padStart(2, "0")
      ).join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
    .replace(
      /[xy]/g,
      (character) => {
        const randomValue =
          Math.floor(
            Math.random() *
            16
          );

        const value =
          character ===
          "x"
            ? randomValue
            : (
                randomValue &
                0x3
              ) |
              0x8;

        return value
          .toString(16);
      }
    );
}

function getBrowserStorage(
  kind:
    | "localStorage"
    | "sessionStorage"
) {
  try {
    return window[kind];
  }
  catch {
    return null;
  }
}

function getOrCreateStorageId(
  storage:
    | Storage
    | null,
  key: string
) {
  try {
    const existing =
      storage?.getItem(
        key
      );

    if (
      existing &&
      UUID_PATTERN.test(
        existing
      )
    ) {
      return existing;
    }

    const created =
      createUuid();

    storage?.setItem(
      key,
      created
    );

    return created;
  }
  catch {
    return createUuid();
  }
}

function getReferrerHost() {
  if (!document.referrer) {
    return null;
  }

  try {
    return new URL(
      document.referrer
    ).hostname.toLowerCase();
  }
  catch {
    return null;
  }
}

function loadYouTubeApi() {
  if (
    window.YT?.Player
  ) {
    return Promise.resolve(
      window.YT
    );
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise =
    new Promise<YouTubeApi>(
      (
        resolve,
        reject
      ) => {
        const previousCallback =
          window
            .onYouTubeIframeAPIReady;

        const timeout =
          window.setTimeout(
            () => {
              reject(
                new Error(
                  "YouTube iframe API timed out."
                )
              );
            },
            15000
          );

        window
          .onYouTubeIframeAPIReady =
          () => {
            try {
              previousCallback?.();
            }
            catch {
              // Another callback must
              // not block this tracker.
            }

            if (
              window.YT?.Player
            ) {
              window.clearTimeout(
                timeout
              );

              resolve(
                window.YT
              );
            }
            else {
              reject(
                new Error(
                  "YouTube iframe API did not initialize."
                )
              );
            }
          };

        if (
          !document.getElementById(
            YOUTUBE_SCRIPT_ID
          )
        ) {
          const script =
            document.createElement(
              "script"
            );

          script.id =
            YOUTUBE_SCRIPT_ID;

          script.src =
            "https://www.youtube.com/iframe_api";

          script.async =
            true;

          script.onerror =
            () => {
              window.clearTimeout(
                timeout
              );

              reject(
                new Error(
                  "YouTube iframe API failed to load."
                )
              );
            };

          document.head.appendChild(
            script
          );
        }
      }
    );

  return youtubeApiPromise;
}

export default function PropertyEngagementTracker({
  listingId,
  slug,
  youtubeIframeId,
}: PropertyEngagementTrackerProps) {
  const activeRef =
    useRef(false);

  const videoLoadingRef =
    useRef(false);

  const videoPlayerRef =
    useRef<
      YouTubePlayer | null
    >(null);

  const progressTimerRef =
    useRef<
      number | null
    >(null);

  const sentEventKeysRef =
    useRef(
      new Set<string>()
    );

  useEffect(() => {
    activeRef.current =
      true;

    const visitorId =
      getOrCreateStorageId(
        getBrowserStorage(
          "localStorage"
        ),
        VISITOR_STORAGE_KEY
      );

    const sessionId =
      getOrCreateStorageId(
        getBrowserStorage(
          "sessionStorage"
        ),
        SESSION_STORAGE_KEY
      );

    const searchParameters =
      new URLSearchParams(
        window.location.search
      );

    const basePayload = {
      listingId,
      slug,
      visitorId,
      sessionId,
      marketingSource:
        searchParameters.get(
          "src"
        ) ||
        searchParameters.get(
          "source"
        ),
      utmSource:
        searchParameters.get(
          "utm_source"
        ),
      utmMedium:
        searchParameters.get(
          "utm_medium"
        ),
      utmCampaign:
        searchParameters.get(
          "utm_campaign"
        ),
      utmContent:
        searchParameters.get(
          "utm_content"
        ),
      referrerHost:
        getReferrerHost(),
    };

    const submitPayload = (
      payload: Record<
        string,
        unknown
      >,
      useBeacon: boolean
    ) => {
      const body =
        JSON.stringify(
          payload
        );

      if (
        useBeacon &&
        typeof navigator
          .sendBeacon ===
          "function"
      ) {
        const queued =
          navigator
            .sendBeacon(
              "/api/public/property-engagement",
              new Blob(
                [body],
                {
                  type:
                    "application/json",
                }
              )
            );

        if (queued) {
          return Promise.resolve(
            true
          );
        }
      }

      return fetch(
        "/api/public/property-engagement",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          credentials:
            "omit",
          keepalive:
            true,
          body,
        }
      )
        .then(
          (response) =>
            response.ok
        )
        .catch(
          () =>
            false
        );
    };

    const sendEvent = (
      eventType:
        EngagementEventType,
      placement?: string,
      dedupeKey?: string,
      useBeacon = false
    ) => {
      if (
        !activeRef.current
      ) {
        return;
      }

      if (
        dedupeKey &&
        sentEventKeysRef
          .current
          .has(
            dedupeKey
          )
      ) {
        return;
      }

      if (dedupeKey) {
        sentEventKeysRef
          .current
          .add(
            dedupeKey
          );
      }

      const payload = {
        ...basePayload,
        clientEventId:
          createUuid(),
        eventType,
        placement:
          placement ||
          null,
      };

      void submitPayload(
        payload,
        useBeacon
      ).then(
        (ok) => {
          if (
            !ok &&
            dedupeKey
          ) {
            sentEventKeysRef
              .current
              .delete(
                dedupeKey
              );
          }
        }
      );
    };

    sendEvent(
      "page_view",
      undefined,
      "page_view"
    );

    const clickHandler = (
      event: MouseEvent
    ) => {
      const eventTarget =
        event.target;

      if (
        !(eventTarget instanceof Element)
      ) {
        return;
      }

      const trackedElement =
        eventTarget.closest<HTMLElement>(
          "[data-property-engagement-event]"
        );

      if (!trackedElement) {
        return;
      }

      const requestedEvent =
        trackedElement.getAttribute(
          "data-property-engagement-event"
        ) as
          | EngagementEventType
          | null;

      if (
        !requestedEvent ||
        !EVENT_TYPES.has(
          requestedEvent
        )
      ) {
        return;
      }

      const placement =
        trackedElement.getAttribute(
          "data-property-engagement-placement"
        ) ||
        undefined;

      sendEvent(
        requestedEvent,
        placement,
        undefined,
        true
      );
    };

    document.addEventListener(
      "click",
      clickHandler
    );

    const clearProgressTimer =
      () => {
        if (
          progressTimerRef
            .current !==
          null
        ) {
          window.clearInterval(
            progressTimerRef
              .current
          );

          progressTimerRef
            .current =
            null;
        }
      };

    const measureProgress =
      (
        player:
          YouTubePlayer,
        completed = false
      ) => {
        try {
          const duration =
            player.getDuration();

          if (
            !Number.isFinite(
              duration
            ) ||
            duration <= 0
          ) {
            return;
          }

          const currentTime =
            player.getCurrentTime();

          const percentage =
            completed
              ? 100
              : (
                  currentTime /
                  duration
                ) *
                100;

          if (
            percentage >= 25
          ) {
            sendEvent(
              "video_progress_25",
              "embedded_video",
              "video_progress_25"
            );
          }

          if (
            percentage >= 50
          ) {
            sendEvent(
              "video_progress_50",
              "embedded_video",
              "video_progress_50"
            );
          }

          if (
            percentage >= 75
          ) {
            sendEvent(
              "video_progress_75",
              "embedded_video",
              "video_progress_75"
            );
          }

          if (
            percentage >= 99
          ) {
            sendEvent(
              "video_complete",
              "embedded_video",
              "video_complete"
            );
          }
        }
        catch {
          // Player progress is
          // best-effort.
        }
      };

    if (
      youtubeIframeId &&
      !videoPlayerRef.current &&
      !videoLoadingRef.current
    ) {
      videoLoadingRef.current =
        true;

      void loadYouTubeApi()
        .then(
          (api) => {
            if (
              !activeRef.current ||
              videoPlayerRef.current
            ) {
              return;
            }

            const iframe =
              document.getElementById(
                youtubeIframeId
              );

            if (
              !(iframe instanceof
                HTMLIFrameElement)
            ) {
              return;
            }

            videoPlayerRef.current =
              new api.Player(
                youtubeIframeId,
                {
                  events: {
                    onStateChange:
                      (
                        playerEvent
                      ) => {
                        if (
                          !activeRef
                            .current
                        ) {
                          return;
                        }

                        if (
                          playerEvent.data ===
                          api.PlayerState
                            .PLAYING
                        ) {
                          sendEvent(
                            "video_play",
                            "embedded_video",
                            "video_play"
                          );

                          clearProgressTimer();

                          progressTimerRef.current =
                            window.setInterval(
                              () => {
                                measureProgress(
                                  playerEvent
                                    .target
                                );
                              },
                              1000
                            );

                          return;
                        }

                        clearProgressTimer();

                        if (
                          playerEvent.data ===
                          api.PlayerState
                            .ENDED
                        ) {
                          measureProgress(
                            playerEvent
                              .target,
                            true
                          );
                        }
                      },
                  },
                }
              );
          }
        )
        .catch(
          (error: unknown) => {
            console.error(
              "[property-engagement] YouTube tracking unavailable.",
              error
            );
          }
        )
        .finally(
          () => {
            videoLoadingRef.current =
              false;
          }
        );
    }

    return () => {
      activeRef.current =
        false;

      document.removeEventListener(
        "click",
        clickHandler
      );

      clearProgressTimer();

      try {
        videoPlayerRef
          .current
          ?.destroy?.();
      }
      catch {
        // Player teardown is
        // best-effort.
      }

      videoPlayerRef.current =
        null;
    };
  }, [
    listingId,
    slug,
    youtubeIframeId,
  ]);

  return null;
}
