import { useEffect, useState } from 'react';

// Define the type for metrics
interface PerformanceMetrics {
  remindersSent: number;
  appointmentsAttended: number;
  appointmentsMissed: number;
}

const PerformanceDashboard = () => {
  // Explicitly define the type for metrics
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    // Fetch metrics from the API
    const fetchMetrics = async () => {
      const response = await fetch('/api/dashboard/metrics');
      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    };

    fetchMetrics();
  }, []);

  // If metrics is null (i.e., still loading), display a loading message
  if (!metrics) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Performance Dashboard</h1>
      <div>
        <p>Reminders Sent: {metrics.remindersSent}</p>
        <p>Appointments Attended: {metrics.appointmentsAttended}</p>
        <p>Appointments Missed: {metrics.appointmentsMissed}</p>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
