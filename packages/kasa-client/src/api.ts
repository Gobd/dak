import {
  client,
  healthHealthGet,
  discoverKasaDiscoverPost,
  statusKasaStatusGet,
  toggleKasaTogglePost,
  toggleByNameKasaToggleByNamePost,
  brightnessKasaBrightnessPost,
  countdownKasaCountdownPost,
  scheduleKasaScheduleGet,
  addScheduleKasaSchedulePost,
  updateScheduleKasaSchedulePut,
  deleteScheduleKasaScheduleDelete,
  type KasaDevice,
  type ScheduleResponse,
  type ToggleResponse,
  type BrightnessResponse,
  type CountdownResponse,
} from '@dak/api-client';

/**
 * Create a Kasa API client for a specific relay URL
 */
export function createKasaClient(relayUrl: string) {
  const baseUrl = relayUrl.endsWith('/') ? relayUrl.slice(0, -1) : relayUrl;

  function configureClient() {
    client.setConfig({ baseUrl });
  }

  /**
   * Check if the relay is healthy/reachable
   */
  async function checkHealth(): Promise<boolean> {
    try {
      configureClient();
      await healthHealthGet({ throwOnError: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Discover all Kasa devices on the network
   */
  async function discoverDevices(): Promise<KasaDevice[]> {
    configureClient();
    const result = await discoverKasaDiscoverPost({ throwOnError: true });
    return result.data;
  }

  /**
   * Get status of a specific device
   */
  async function getDeviceStatus(ip: string): Promise<ToggleResponse> {
    configureClient();
    const result = await statusKasaStatusGet({ query: { ip }, throwOnError: true });
    return result.data;
  }

  /**
   * Toggle a device on/off
   */
  async function toggleDevice(ip: string): Promise<ToggleResponse> {
    configureClient();
    const result = await toggleKasaTogglePost({ body: { ip }, throwOnError: true });
    return result.data;
  }

  /**
   * Toggle a device by name (for voice commands)
   */
  async function toggleDeviceByName(
    name: string,
    state?: boolean
  ): Promise<ToggleResponse | { error: string }> {
    configureClient();
    const result = await toggleByNameKasaToggleByNamePost({
      body: { name, state: state ?? null },
      throwOnError: true,
    });
    return result.data;
  }

  /**
   * Set brightness for dimmable devices (0-100)
   */
  async function setBrightness(ip: string, brightness: number): Promise<BrightnessResponse> {
    if (brightness < 0 || brightness > 100) {
      throw new Error('Brightness must be between 0 and 100');
    }
    configureClient();
    const result = await brightnessKasaBrightnessPost({
      body: { ip, brightness },
      throwOnError: true,
    });
    return result.data;
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
    configureClient();
    const result = await countdownKasaCountdownPost({
      body: { ip, minutes, action },
      throwOnError: true,
    });
    return result.data;
  }

  /**
   * Get schedule rules for a device
   * For child devices (multi-plugs), pass the child_id
   */
  async function getSchedule(ip: string, childId?: string | null): Promise<ScheduleResponse> {
    configureClient();
    const result = await scheduleKasaScheduleGet({
      query: { ip, child_id: childId ?? undefined },
      throwOnError: true,
    });
    return result.data;
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
    configureClient();
    const result = await addScheduleKasaSchedulePost({
      body: { ip, action, time, days },
      throwOnError: true,
    });
    return result.data;
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
    configureClient();
    const result = await updateScheduleKasaSchedulePut({
      body: { ip, rule_id: ruleId, ...updates },
      throwOnError: true,
    });
    return result.data;
  }

  /**
   * Delete a schedule rule
   */
  async function deleteScheduleRule(ip: string, ruleId: string): Promise<ScheduleResponse> {
    configureClient();
    const result = await deleteScheduleKasaScheduleDelete({
      body: { ip, rule_id: ruleId },
      throwOnError: true,
    });
    return result.data;
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
