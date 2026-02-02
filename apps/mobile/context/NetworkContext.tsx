import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';

export interface NetworkContextValue {
  isOnline: boolean;
  connectionType: NetInfoStateType | null;
  lastOnlineAt: Date | null;
  isInternetReachable: boolean | null;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

interface NetworkProviderProps {
  children: React.ReactNode;
  onConnectivityRestored?: () => void;
}

export function NetworkProvider({ children, onConnectivityRestored }: NetworkProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<NetInfoStateType | null>(null);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(new Date());
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);

  const wasOfflineRef = useRef(false);
  const onConnectivityRestoredRef = useRef(onConnectivityRestored);

  useEffect(() => {
    onConnectivityRestoredRef.current = onConnectivityRestored;
  }, [onConnectivityRestored]);

  const handleNetworkChange = useCallback((state: NetInfoState) => {
    const nowOnline = state.isConnected === true && state.isInternetReachable !== false;

    setConnectionType(state.type);
    setIsInternetReachable(state.isInternetReachable);

    if (nowOnline) {
      setLastOnlineAt(new Date());
      if (wasOfflineRef.current && onConnectivityRestoredRef.current) {
        onConnectivityRestoredRef.current();
      }
      wasOfflineRef.current = false;
    } else {
      wasOfflineRef.current = true;
    }

    setIsOnline(nowOnline);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    NetInfo.fetch().then(handleNetworkChange);
    return () => { unsubscribe(); };
  }, [handleNetworkChange]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        NetInfo.fetch().then(handleNetworkChange);
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => { subscription.remove(); };
  }, [handleNetworkChange]);

  const value = React.useMemo<NetworkContextValue>(() => ({
    isOnline,
    connectionType,
    lastOnlineAt,
    isInternetReachable,
  }), [isOnline, connectionType, lastOnlineAt, isInternetReachable]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkContext(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetworkContext must be used within a NetworkProvider');
  }
  return context;
}
