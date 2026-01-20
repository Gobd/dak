import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createKasaClient } from './api';
import type { KasaDevice } from './types';

/**
 * Create Kasa hooks for a specific relay URL
 */
export function createKasaHooks(relayUrl: string) {
  const client = createKasaClient(relayUrl);

  /**
   * Hook to discover all Kasa devices
   */
  function useDevices(options?: { refetchInterval?: number; enabled?: boolean }) {
    return useQuery({
      queryKey: ['kasa-devices', relayUrl],
      queryFn: async () => {
        const isHealthy = await client.checkHealth();
        if (!isHealthy) {
          throw new Error('Relay offline');
        }
        return client.discoverDevices();
      },
      refetchInterval: options?.refetchInterval ?? 30000,
      enabled: options?.enabled ?? true,
    });
  }

  /**
   * Hook to toggle a device
   */
  function useToggleDevice() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (device: KasaDevice) => client.toggleDevice(device.ip),
      onMutate: async (device) => {
        await queryClient.cancelQueries({ queryKey: ['kasa-devices', relayUrl] });
        const previous = queryClient.getQueryData<KasaDevice[]>(['kasa-devices', relayUrl]);
        queryClient.setQueryData<KasaDevice[]>(['kasa-devices', relayUrl], (old) =>
          old?.map((d) => (d.ip === device.ip ? { ...d, on: !d.on } : d))
        );
        return { previous };
      },
      onError: (_err, _device, context) => {
        if (context?.previous) {
          queryClient.setQueryData(['kasa-devices', relayUrl], context.previous);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['kasa-devices', relayUrl] });
      },
    });
  }

  /**
   * Hook to set device brightness
   */
  function useBrightness() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: ({ ip, brightness }: { ip: string; brightness: number }) =>
        client.setBrightness(ip, brightness),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['kasa-devices', relayUrl] });
      },
    });
  }

  /**
   * Hook to set countdown timer
   */
  function useCountdown() {
    return useMutation({
      mutationFn: ({
        ip,
        minutes,
        action,
      }: {
        ip: string;
        minutes: number;
        action: 'on' | 'off';
      }) => client.setCountdown(ip, minutes, action),
    });
  }

  /**
   * Hook to get schedule for a device
   */
  function useSchedule(ip: string | null, options?: { enabled?: boolean }) {
    return useQuery({
      queryKey: ['kasa-schedule', relayUrl, ip],
      queryFn: () => (ip ? client.getSchedule(ip) : null),
      enabled: (options?.enabled ?? true) && !!ip,
      staleTime: 10000,
    });
  }

  /**
   * Hook for schedule mutations (add, update, delete, toggle)
   */
  function useScheduleMutation(deviceIp: string | null) {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (params: {
        type: 'add' | 'update' | 'delete' | 'toggle';
        ruleId?: string;
        action?: 'on' | 'off';
        time?: string;
        days?: string[];
        enabled?: boolean;
      }) => {
        if (!deviceIp) throw new Error('No device selected');

        switch (params.type) {
          case 'add':
            return client.addScheduleRule(deviceIp, params.action!, params.time!, params.days!);
          case 'update':
            return client.updateScheduleRule(deviceIp, params.ruleId!, {
              action: params.action,
              time: params.time,
              days: params.days,
            });
          case 'toggle':
            return client.updateScheduleRule(deviceIp, params.ruleId!, {
              enabled: params.enabled,
            });
          case 'delete':
            return client.deleteScheduleRule(deviceIp, params.ruleId!);
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['kasa-schedule', relayUrl, deviceIp] });
      },
    });
  }

  return {
    client,
    useDevices,
    useToggleDevice,
    useBrightness,
    useCountdown,
    useSchedule,
    useScheduleMutation,
  };
}

/**
 * Hook that creates memoized Kasa hooks for a relay URL
 */
export function useKasaClient(relayUrl: string) {
  return useMemo(() => createKasaHooks(relayUrl), [relayUrl]);
}
