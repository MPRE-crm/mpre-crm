import axios from "axios";

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

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
  to: string;
  from?: string;
  variables?: Record<string, any>;
}) {
  const { flowSid, to, from = TWILIO_PHONE_NUMBER!, variables = {} } = params;

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
  return res.data;
}