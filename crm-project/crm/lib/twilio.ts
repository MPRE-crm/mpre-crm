import axios from "axios";

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.warn("Twilio credentials missing. Check .env.local");
}

export function getFlowSidFromEnvVar(envVar: string): string {
  const sid = process.env[envVar as keyof NodeJS.ProcessEnv] as string | undefined;
  if (!sid || !sid.startsWith("FW")) {
    throw new Error(`Flow SID missing/invalid for ${envVar}`);
  }
  return sid;
}

export async function executeStudioFlow(params: {
  flowSid: string;
  to: string;                       // E.164
  from?: string;                    // defaults to TWILIO_FROM_NUMBER
  variables?: Record<string, any>;  // passed to Flow as Parameters
}) {
  const { flowSid, to, from = TWILIO_FROM_NUMBER!, variables = {} } = params;

  const url = `https://studio.twilio.com/v2/Flows/${flowSid}/Executions`;
  const data = new URLSearchParams({
    To: to,
    From: from,
    Parameters: JSON.stringify(variables),
  });

  const auth = {
    username: TWILIO_ACCOUNT_SID!,
    password: TWILIO_AUTH_TOKEN!,
  };

  const res = await axios.post(url, data, { auth });
  return res.data; // Twilio Execution object
}
