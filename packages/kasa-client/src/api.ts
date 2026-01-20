import type {
  KasaDevice,
  ScheduleResponse,
  ToggleResponse,
  BrightnessResponse,
  CountdownResponse,
} from './types';

/**
 * Create a Kasa API client for a specific relay URL
 */
export function createKasaClient(relayUrl: string) {
  const baseUrl = relayUrl.endsWith('/') ? relayUrl.slice(0, -1) : relayUrl;

  /**
   * Check if the relay is healthy/reachable
   */
  async function checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Discover all Kasa devices on the network
   */
  async function discoverDevices(): Promise<KasaDevice[]> {
    const res = await fetch(`${baseUrl}/kasa/discover`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`Failed to discover devices: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Get status of a specific device
   */
  async function getDeviceStatus(ip: string): Promise<ToggleResponse> {
    const res = await fetch(`${baseUrl}/kasa/status?ip=${encodeURIComponent(ip)}`);
    if (!res.ok) {
      throw new Error(`Failed to get device status: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Toggle a device on/off
   */
  async function toggleDevice(ip: string): Promise<ToggleResponse> {
    const res = await fetch(`${baseUrl}/kasa/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    if (!res.ok) {
      throw new Error(`Failed to toggle device: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Toggle a device by name (for voice commands)
   */
  async function toggleDeviceByName(
    name: string,
    state?: boolean
  ): Promise<ToggleResponse | { error: string }> {
    const res = await fetch(`${baseUrl}/kasa/toggle-by-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, state }),
    });
    if (!res.ok) {
      throw new Error(`Failed to toggle device by name: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Set brightness for dimmable devices (0-100)
   */
  async function setBrightness(ip: string, brightness: number): Promise<BrightnessResponse> {
    if (brightness < 0 || brightness > 100) {
      throw new Error('Brightness must be between 0 and 100');
    }
    const res = await fetch(`${baseUrl}/kasa/brightness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, brightness }),
    });
    if (!res.ok) {
      throw new Error(`Failed to set brightness: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Set a countdown timer to turn device on/off
   */
  async function setCountdown(
    ip: string,
    minutes: number,
    action: 'on' | 'off'
  ): Promise<CountdownResponse> {
    if (minutes < 1) {
      throw new Error('Minutes must be at least 1');
    }
    const res = await fetch(`${baseUrl}/kasa/countdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, minutes, action }),
    });
    if (!res.ok) {
      throw new Error(`Failed to set countdown: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Get schedule rules for a device
   */
  async function getSchedule(ip: string): Promise<ScheduleResponse> {
    const res = await fetch(`${baseUrl}/kasa/schedule?ip=${encodeURIComponent(ip)}`);
    if (!res.ok) {
      throw new Error(`Failed to get schedule: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Add a new schedule rule
   */
  async function addScheduleRule(
    ip: string,
    action: 'on' | 'off',
    time: string,
    days: string[]
  ): Promise<ScheduleResponse> {
    const res = await fetch(`${baseUrl}/kasa/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, action, time, days }),
    });
    if (!res.ok) {
      throw new Error(`Failed to add schedule rule: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Update an existing schedule rule
   */
  async function updateScheduleRule(
    ip: string,
    ruleId: string,
    updates: {
      enabled?: boolean;
      action?: 'on' | 'off';
      time?: string;
      days?: string[];
    }
  ): Promise<ScheduleResponse> {
    const res = await fetch(`${baseUrl}/kasa/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, rule_id: ruleId, ...updates }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update schedule rule: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Delete a schedule rule
   */
  async function deleteScheduleRule(ip: string, ruleId: string): Promise<ScheduleResponse> {
    const res = await fetch(`${baseUrl}/kasa/schedule`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, rule_id: ruleId }),
    });
    if (!res.ok) {
      throw new Error(`Failed to delete schedule rule: ${res.status}`);
    }
    return res.json();
  }

  return {
    checkHealth,
    discoverDevices,
    getDeviceStatus,
    toggleDevice,
    toggleDeviceByName,
    setBrightness,
    setCountdown,
    getSchedule,
    addScheduleRule,
    updateScheduleRule,
    deleteScheduleRule,
  };
}

export type KasaClient = ReturnType<typeof createKasaClient>;
