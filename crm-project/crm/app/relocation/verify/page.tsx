const copperFont =
  "'Copperplate Gothic Light', 'Copperplate', 'Copperplate Gothic Bold', fantasy";

type VerifyPageProps = {
  searchParams: Promise<{
    status?: string;
    type?: string;
    complete?: string;
    message?: string;
    phone?: string;
    email?: string;
    guide?: string;
  }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;

  const status = params.status;
  const type = params.type;
  const complete = params.complete === "true";
  const message = params.message;
  const phoneVerified = params.phone === "true";
  const emailVerified = params.email === "true";
  const guideStatus = params.guide;

  const isSuccess = status === "success";

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white"
      style={{
        fontFamily: copperFont,
        backgroundImage:
          "linear-gradient(rgba(2, 6, 23, 0.82), rgba(2, 6, 23, 0.92)), url('/Boise.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-white/95 p-8 text-center text-slate-950 shadow-2xl">
        <div className="mb-6 flex items-center justify-center gap-5">
          <img
            src="/MPREcrm.png"
            alt="MPRE Boise"
            className="h-12 w-auto rounded-md"
          />

          <img
            src="/HomesofIdahocrm.png"
            alt="Homes of Idaho"
            className="h-12 w-auto"
          />
        </div>

        {isSuccess ? (
          <>
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-green-700">
              Verification Successful
            </p>

            <h1 className="text-3xl font-bold">
              {complete
                ? "Phone And Email Verified"
                : type === "phone"
                  ? "Phone Verified"
                  : "Email Verified"}
            </h1>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="font-bold text-slate-800">Phone verification</span>
                <span
                  className={
                    phoneVerified
                      ? "font-bold text-green-700"
                      : "font-bold text-orange-600"
                  }
                >
                  {phoneVerified ? "✓ Verified" : "⏳ Pending"}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3">
                <span className="font-bold text-slate-800">Email verification</span>
                <span
                  className={
                    emailVerified
                      ? "font-bold text-green-700"
                      : "font-bold text-orange-600"
                  }
                >
                  {emailVerified ? "✓ Verified" : "⏳ Pending"}
                </span>
              </div>
            </div>

            {complete ? (
              <>
                <p className="mt-5 leading-7 text-slate-700">
                  Perfect. Your phone and email are both verified. We&apos;ll email
                  your 2026 Boise Idaho Area Relocation Guide shortly. Please
                  check your inbox, promotions folder, and spam or junk folder
                  just in case.
                </p>

                {guideStatus === "sent" && (
                  <p className="mt-4 rounded-xl bg-green-100 p-3 text-sm leading-6 text-green-800">
                    Your guide email is being sent now.
                  </p>
                )}

                {guideStatus === "failed" && (
                  <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm leading-6 text-red-700">
                    Your verification worked, but the guide email had trouble
                    sending. We&apos;ll need to resend it.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-5 leading-7 text-slate-700">
                Nice. One step is complete. Now tap the other verification link
                we sent you. If you do not see the email, please check your spam,
                junk, or promotions folder.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-red-700">
              Verification Problem
            </p>

            <h1 className="text-3xl font-bold">Verification Failed</h1>

            <p className="mt-4 leading-7 text-slate-700">
              This verification link is missing, expired, or invalid. Please go
              back to the relocation guide page and request a new verification
              link.
            </p>

            {message && (
              <p className="mt-3 text-xs text-slate-500">Error: {message}</p>
            )}
          </>
        )}

        <a
          href="/relocation"
          className="mt-8 inline-block rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-600"
        >
          Back To Relocation Guide Page
        </a>

        <p className="mt-6 text-xs text-slate-500">
          MPRE Boise with Homes of Idaho · Powered by EasyRealtor.homes
        </p>
      </div>
    </main>
  );
}