const copperFont =
  "'Copperplate Gothic Light', 'Copperplate', 'Copperplate Gothic Bold', fantasy";

type VerifyPageProps = {
  searchParams: Promise<{
    status?: string;
    type?: string;
    complete?: string;
    message?: string;
  }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;

  const status = params.status;
  const type = params.type;
  const complete = params.complete === "true";
  const message = params.message;

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
              {type === "phone"
                ? "Phone Verified"
                : "Email Verified"}
            </h1>

            {complete ? (
              <p className="mt-4 leading-7 text-slate-700">
                Perfect. Your phone and email are both verified. The next step
                is sending your 2026 Boise Idaho Area Relocation Guide.
              </p>
            ) : (
              <p className="mt-4 leading-7 text-slate-700">
                Nice. Now verify the other link we sent you. Once both your
                phone and email are verified, we will send the relocation guide.
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
              This verification link is missing, expired, or invalid.
            </p>

            {message && (
              <p className="mt-3 text-xs text-slate-500">
                Error: {message}
              </p>
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