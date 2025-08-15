import { supabase } from '../../../lib/supabase'

type CallLog = {
  id: number
  call_sid: string
  status: string
  from_number: string
  to_number: string
  direction: string
  timestamp: string
}

export default async function CallLogsPage() {
  const { data: callLogs, error } = await supabase
    .from('call_logs')
    .select('*')
    .order('timestamp', { ascending: false })

  if (error) return <div className="p-4 text-red-600">Error loading call logs: {error.message}</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Call Logs</h1>

      {callLogs?.length === 0 ? (
        <p>No call logs found.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">From</th>
              <th className="p-2 text-left">To</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Direction</th>
              <th className="p-2 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {(callLogs as CallLog[]).map((log) => (
              <tr key={log.id} className="border-t">
                <td className="p-2">{log.from_number}</td>
                <td className="p-2">{log.to_number}</td>
                <td className="p-2">{log.status}</td>
                <td className="p-2">{log.direction}</td>
                <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
