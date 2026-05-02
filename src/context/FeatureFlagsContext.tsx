import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as configcat from 'configcat-js';

const SDK_KEY = import.meta.env.VITE_CONFIGCAT_SDK_KEY as string | undefined;

let _client: ReturnType<typeof configcat.getClient> | null = null;

function getClient() {
  if (!SDK_KEY) return null;
  if (_client) return _client;
  _client = configcat.getClient(SDK_KEY, configcat.PollingMode.LazyLoad, {
    cacheTimeToLiveSeconds: 60,
  });
  return _client;
}

interface FeatureFlags {
  checkoutEnabled: boolean;
  maintenanceEnabled: boolean;
}

const defaults: FeatureFlags = {
  checkoutEnabled: true,
  maintenanceEnabled: false,
};

const FeatureFlagsContext = createContext<FeatureFlags>(defaults);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(defaults);

  useEffect(() => {
    const client = getClient();
    if (!client) return;

    async function load() {
      if (!client) return;
      const [checkoutEnabled, maintenanceEnabled] = await Promise.all([
        client.getValueAsync('checkout_enabled', defaults.checkoutEnabled),
        client.getValueAsync('maintenance_enabled', defaults.maintenanceEnabled),
      ]);
      setFlags({ checkoutEnabled, maintenanceEnabled });
    }

    load();
  }, []);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
