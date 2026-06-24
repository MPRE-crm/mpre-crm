"use client";

import { useState } from "react";

const copperFont =
  "'Copperplate Gothic Light', 'Copperplate', 'Copperplate Gothic Bold', fantasy";

const guidePages = [
  {
    title: "Guide Cover",
    subtitle: "2026 Boise Idaho Area Relocation Guide",
    src: "/relocation-guide/guide-cover.jpg",
  },
  {
    title: "Treasure Valley Map",
    subtitle: "See how the major cities connect",
    src: "/relocation-guide/guide-map.jpg",
  },
  {
    title: "12 Reasons To Love The Valley",
    subtitle: "Lifestyle, safety, seasons, nature, and more",
    src: "/relocation-guide/guide-reasons.jpg",
  },
  {
    title: "Welcome To Boise",
    subtitle: "Boise neighborhoods and local lifestyle",
    src: "/relocation-guide/guide-boise.jpg",
  },
  {
    title: "Schools & Education",
    subtitle: "Public schools, homeschool, private schools, and colleges",
    src: "/relocation-guide/guide-schools.jpg",
  },
  {
    title: "Neighborhoods",
    subtitle: "Popular communities across the Treasure Valley",
    src: "/relocation-guide/guide-neighborhoods.jpg",
  },
  {
    title: "Outdoor Lifestyle",
    subtitle: "Trails, parks, recreation, and Idaho adventure",
    src: "/relocation-guide/guide-outdoors.jpg",
  },
];

const guideBenefits = [
  "A Treasure Valley map showing how Boise, Meridian, Eagle, Nampa, Star, Kuna, Caldwell, and surrounding cities connect",
  "City-by-city breakdowns so you can compare the feel, commute, lifestyle, and local highlights of each area",
  "Public school district information, plus homeschool, private school, college, and university resources",
  "Neighborhood insights, popular communities, and real estate-focused local context",
  "Outdoor lifestyle info covering trails, parks, skiing, hot springs, rafting, golf, and the Boise River Greenbelt",
  "Healthcare, major employers, local restaurants, coffee shops, events, landmarks, and favorite places",
  "A better starting point before you begin searching homes or guessing by zip code",
];

const trustPoints = [
  "Local Boise / Treasure Valley real estate guidance",
  "Guide delivered after phone and email verification",
  "No pressure. Just useful relocation info.",
];

export default function RelocationPage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    move_timeline: "",
    price_range: "",
    consent: false,
  });

  const [activePage, setActivePage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [error, setError] = useState("");

  const currentGuidePage = guidePages[activePage];

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function scrollToPreview() {
    const previewSection = document.getElementById("guide-preview");
    previewSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToForm() {
    const formSection = document.getElementById("guide-form");
    formSection?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function goToPreviousPage() {
    setActivePage((prev) => (prev === 0 ? guidePages.length - 1 : prev - 1));
  }

  function goToNextPage() {
    setActivePage((prev) => (prev === guidePages.length - 1 ? 0 : prev + 1));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    setLeadId("");

    if (!form.consent) {
      setError("Please agree to be contacted before continuing.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/relocation/start-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          email: form.email,
          move_timeline: form.move_timeline,
          price_range: form.price_range,
          consent: form.consent,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Verification could not be started.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLeadId(result.lead_id || "");
      setLoading(false);

      setForm({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        move_timeline: "",
        price_range: "",
        consent: false,
      });
    } catch (err: any) {
      console.error("Verification start error:", err);
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main
      className="relative min-h-screen bg-slate-950 bg-cover bg-center bg-no-repeat text-white"
      style={{
        fontFamily: copperFont,
        backgroundImage:
          "linear-gradient(rgba(2, 6, 23, 0.76), rgba(2, 6, 23, 0.9)), url('/Boise.jpg')",
      }}
    >
      <button
        type="button"
        onClick={scrollToPreview}
        className="fixed right-5 top-1/2 z-50 hidden -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-white/20 bg-orange-500 px-3 py-5 text-xs font-bold uppercase tracking-widest text-white shadow-2xl transition hover:bg-orange-600 lg:flex"
        style={{ fontFamily: copperFont }}
        aria-label="Scroll down to preview the relocation guide"
      >
        <span className="rotate-180 [writing-mode:vertical-rl]">
          Preview Guide
        </span>
        <span className="mt-2 animate-bounce text-2xl leading-none">↓</span>
      </button>

      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <img
              src="/MPREcrm.png"
              alt="MPRE Boise"
              className="h-16 w-auto rounded-md"
            />

            <img
              src="/HomesofIdahocrm.png"
              alt="Homes of Idaho"
              className="h-16 w-auto"
            />
          </div>

          <div className="text-right text-xs text-slate-300">
            <p>MPRE Boise with Homes of Idaho</p>
            <p>Boise, Idaho Real Estate</p>
          </div>
        </div>

        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-orange-400">
              Complimentary 2026 Relocation Guide
            </p>

            <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
              Get The 2026 Boise Idaho Area Relocation Guide
            </h1>

            <p className="mb-6 max-w-xl text-lg leading-8 text-slate-200">
              Compare Boise, Meridian, Eagle, Nampa, Star, Kuna, Caldwell,
              schools, neighborhoods, outdoor lifestyle, employers, healthcare,
              and local favorites before you start guessing where to live.
            </p>

            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center text-xs leading-5 text-slate-100 shadow-lg backdrop-blur"
                >
                  {point}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-sm text-slate-200 shadow-xl backdrop-blur">
              <p className="mb-3 text-lg font-semibold text-white">
                Inside the guide, you&apos;ll get:
              </p>

              <ul className="space-y-3 leading-6">
                {guideBenefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                      ✓
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={scrollToPreview}
              className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/20 bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur hover:bg-orange-600 lg:hidden"
              style={{ fontFamily: copperFont }}
            >
              Preview the guide below
              <span className="animate-bounce text-xl leading-none">↓</span>
            </button>
          </div>

          <form
            id="guide-form"
            onSubmit={handleSubmit}
            className="rounded-3xl bg-white/95 p-6 text-slate-950 shadow-2xl backdrop-blur"
            style={{ fontFamily: copperFont }}
          >
            <div className="mb-5 rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-xs uppercase tracking-widest text-orange-400">
                Step 1 of 3
              </p>
              <h2 className="mt-2 text-2xl font-bold">Start Verification</h2>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                We verify your phone and email before sending the full guide, so
                fake submissions do not trigger delivery.
              </p>
            </div>

            <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-xs leading-5 text-green-800">
              ✓ ✓ No pressure. ✓ The guide is sent after phone and
              email verification.
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                style={{ fontFamily: copperFont }}
                placeholder="First name"
                value={form.first_name}
                onChange={(e) => updateField("first_name", e.target.value)}
                required
              />

              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                style={{ fontFamily: copperFont }}
                placeholder="Last name"
                value={form.last_name}
                onChange={(e) => updateField("last_name", e.target.value)}
                required
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                style={{ fontFamily: copperFont }}
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                required
              />

              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                style={{ fontFamily: copperFont }}
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
            </div>

            <p className="mt-3 text-[11px] leading-5 text-slate-600">
              Your phone and email are used to verify your request and deliver
              the guide. Consent is not required to buy or sell real estate.
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                Optional: Help Samantha personalize your follow-up
              </p>

              <select
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                style={{ fontFamily: copperFont }}
                value={form.move_timeline}
                onChange={(e) => updateField("move_timeline", e.target.value)}
              >
                <option value="">When are you thinking about moving?</option>
                <option value="0-3 months">0-3 months</option>
                <option value="3-6 months">3-6 months</option>
                <option value="6-12 months">6-12 months</option>
                <option value="12+ months">12+ months</option>
                <option value="Just researching">Just researching</option>
              </select>

              <select
                className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3"
                style={{ fontFamily: copperFont }}
                value={form.price_range}
                onChange={(e) => updateField("price_range", e.target.value)}
              >
                <option value="">Price range</option>
                <option value="Under $400k">Under $400k</option>
                <option value="$400k-$550k">$400k-$550k</option>
                <option value="$550k-$700k">$550k-$700k</option>
                <option value="$700k-$900k">$700k-$900k</option>
                <option value="$900k+">$900k+</option>
                <option value="Not sure yet">Not sure yet</option>
              </select>
            </div>

            <label className="mt-4 flex gap-3 text-xs leading-5 text-slate-700">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(e) => updateField("consent", e.target.checked)}
                className="mt-1"
                required
              />

              <span>
                I agree to receive calls, texts, and emails from MPRE Boise with
                Homes of Idaho about my real estate inquiry, including automated
                follow-up. Consent is not required to buy or sell real estate.
                Message/data rates may apply. Reply STOP to opt out.
              </span>
            </label>

            <p className="mt-3 text-[10px] leading-4 text-slate-500">
              Real estate services provided by MPRE Boise with Homes of Idaho.
              Information submitted through this page is used to respond to your
              inquiry. This page is not a mortgage, legal, tax, or appraisal
              service. Equal Housing Opportunity.
            </p>

            {error && (
              <div className="mt-4 rounded-xl bg-red-100 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

{success && (
  <div className="mt-4 rounded-xl bg-green-100 p-3 text-sm leading-6 text-green-800">
    Verification started. Check your phone and email for the verification links.
    If you do not see the email right away, search your inbox for MPRE Boise.
    {leadId && (
      <span className="mt-1 block text-[11px] text-green-700">
        After both links are verified, we&apos;ll email your 2026 Boise Idaho
        Area Relocation Guide.
      </span>
    )}
  </div>
)}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-orange-500 px-5 py-3 font-bold text-white shadow-lg hover:bg-orange-600 disabled:opacity-60"
              style={{ fontFamily: copperFont }}
            >
              {loading ? "Sending Verification..." : "Start Verification & Get The Guide"}
            </button>

<p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
  Step 2: tap both verification links. Step 3: we&apos;ll email the full guide.
</p>
          </form>
        </div>

        <div
          id="guide-preview"
          className="mt-16 scroll-mt-8 rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur"
        >
          <div className="mb-8 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-400">
              Featured Guide Preview
            </p>

            <h2 className="text-3xl font-bold md:text-4xl">
              A practical look at life in the Treasure Valley
            </h2>

            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-slate-200">
              Flip through a few featured sections from the full relocation
              guide. These previews give you a taste of what&apos;s inside
              without giving away the whole playbook.
            </p>
          </div>

          <div className="mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-slate-950/80 shadow-2xl">
              <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
                <div className="relative flex items-center justify-center bg-slate-900 p-4">
                  <img
                    src={currentGuidePage.src}
                    alt={currentGuidePage.title}
                    className="max-h-[640px] w-full rounded-2xl object-contain shadow-xl"
                  />

                  <button
                    type="button"
                    onClick={goToPreviousPage}
                    className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-white shadow-lg hover:bg-black/80"
                    aria-label="Previous guide preview"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    onClick={goToNextPage}
                    className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-2xl text-white shadow-lg hover:bg-black/80"
                    aria-label="Next guide preview"
                  >
                    ›
                  </button>
                </div>

                <div className="flex flex-col justify-center p-6 md:p-8">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-400">
                    Featured Guide Preview
                  </p>

                  <h3 className="text-3xl font-bold text-white">
                    {currentGuidePage.title}
                  </h3>

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {currentGuidePage.subtitle}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-2">
                    {guidePages.map((page, index) => (
                      <button
                        key={page.src}
                        type="button"
                        onClick={() => setActivePage(index)}
                        className={`h-3 w-3 rounded-full transition ${
                          activePage === index
                            ? "bg-orange-400"
                            : "bg-white/30 hover:bg-white/60"
                        }`}
                        aria-label={`Go to ${page.title}`}
                      />
                    ))}
                  </div>

                  <div className="mt-8 grid grid-cols-4 gap-3 sm:grid-cols-7">
                    {guidePages.map((page, index) => (
                      <button
                        key={page.src}
                        type="button"
                        onClick={() => setActivePage(index)}
                        className={`overflow-hidden rounded-lg border transition ${
                          activePage === index
                            ? "border-orange-400 opacity-100"
                            : "border-white/20 opacity-60 hover:opacity-100"
                        }`}
                        aria-label={`Preview ${page.title}`}
                      >
                        <img
                          src={page.src}
                          alt={page.title}
                          className="h-20 w-full object-cover object-top"
                        />
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={scrollToForm}
                    className="mt-8 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-600"
                    style={{ fontFamily: copperFont }}
                  >
                    Get The Full Guide
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 rounded-3xl border border-white/15 bg-white/10 p-6 text-center shadow-2xl backdrop-blur">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-400">
            Ready To Get The Full Guide?
          </p>

          <h2 className="text-3xl font-bold">
            Verify your phone and email, then we&apos;ll send it over.
          </h2>

<p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-200">
  After both verification links are confirmed, we&apos;ll email your relocation
  guide. Then Samantha can help narrow down areas, timing, home search options,
  and next steps.
</p>

          <button
            type="button"
            onClick={scrollToForm}
            className="mt-6 rounded-full bg-orange-500 px-7 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-600"
            style={{ fontFamily: copperFont }}
          >
            Start Verification
          </button>
        </div>

        <footer className="mt-10 border-t border-white/10 pt-8 text-center text-xs text-slate-400">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-6">
            <img
              src="/MPREcrm.png"
              alt="MPRE Boise"
              className="h-10 w-auto rounded-md opacity-90"
            />

            <img
              src="/HomesofIdahocrm.png"
              alt="Homes of Idaho"
              className="h-10 w-auto opacity-90"
            />

            <img
              src="/easyrealtor-logo.png"
              alt="EasyRealtor"
              className="h-20 w-auto opacity-90"
            />
          </div>

          <p className="text-slate-300">
            MPRE Boise with Homes of Idaho · Boise, Idaho · Equal Housing
            Opportunity
          </p>

          <p className="mt-2">
            Lead capture technology powered by EasyRealtor.homes.
          </p>

          <p className="mt-2">
            © {new Date().getFullYear()} EasyRealtor.homes. All rights
            reserved.
          </p>
        </footer>
      </section>
    </main>
  );
}