"use client";

import React, { FC, ReactNode, useMemo, useState, useEffect, useCallback } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { DEVNET_RPC_ENDPOINT, MAINNET_RPC_ENDPOINT } from '@/lib/constants';

// Import Solana wallet styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Create a context to track if wallet is ready
export const WalletReadyContext = React.createContext<boolean>(false);

interface IsolatedWalletProviderProps {
  children: ReactNode;
  cluster?: 'devnet' | 'mainnet-beta' | 'testnet';
  endpoint?: string;
}

/**
 * A completely isolated wallet provider that prevents event propagation issues
 */
export const IsolatedWalletProvider: FC<IsolatedWalletProviderProps> = ({ children, cluster: initialCluster, endpoint: rpcEndpoint = DEVNET_RPC_ENDPOINT }) => {
  const providerInitTime = performance.now();
  console.log(`[PW] IsolatedWalletProvider: Init at ${providerInitTime.toFixed(0)}ms`);

  // Get current network from environment or props
  const defaultNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK === WalletAdapterNetwork.Mainnet
    ? WalletAdapterNetwork.Mainnet
    : WalletAdapterNetwork.Devnet;
  const cluster = initialCluster || defaultNetwork;
  const network = cluster === WalletAdapterNetwork.Mainnet ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;
  
  const [mounted, setMounted] = useState(false);
  const [walletReadyForContext, setWalletReadyForContext] = useState(false);

  useEffect(() => {
    const now = performance.now();
    console.log(`[PW] IsolatedWalletProvider: useEffect (mount) at ${now.toFixed(0)}ms. Setting mounted = true.`);
    setMounted(true);
  }, []);

  const wallets = useMemo(() => {
    const now = performance.now();
    console.log(`[PW] IsolatedWalletProvider: useMemo (wallets) at ${now.toFixed(0)}ms. Network: ${network}`);
    
    // Use only the most reliable wallet adapters to avoid import errors
    // These adapters cover the most popular Solana wallets
    const walletAdapters = [
      new PhantomWalletAdapter({ network }),
      new SolflareWalletAdapter({ network })
    ];

    console.log(`[PW] Created ${walletAdapters.length} wallet adapters`);
    return walletAdapters;
  }, [network]);

  useEffect(() => {
    const now = performance.now();
    if (mounted && wallets.length > 0) {
      console.log(`[PW] IsolatedWalletProvider: useEffect (walletReadyForContext) at ${now.toFixed(0)}ms. Mounted and wallets ready. Setting walletReadyForContext = true.`);
      setWalletReadyForContext(true);
    } else {
      // This log can be noisy if it runs before mounted is true, so let's be specific
      if (mounted) {
        console.log(`[PW] IsolatedWalletProvider: useEffect (walletReadyForContext) at ${now.toFixed(0)}ms. Mounted but wallets not ready (length: ${wallets.length}).`);
      }
    }
  }, [mounted, wallets]);

  const walletContextValue = useMemo(() => {
    const now = performance.now();
    console.log(`[PW] IsolatedWalletProvider: useMemo (walletContextValue) at ${now.toFixed(0)}ms. Value: ${walletReadyForContext}`);
    return walletReadyForContext;
  }, [walletReadyForContext]);

  if (!mounted) {
    // Optional: Render placeholder or null if server-side or before mount to avoid flash of unstyled content
    // For now, null to prevent wallet UI from attempting to render prematurely
    const now = performance.now();
    console.log(`[PW] IsolatedWalletProvider: Not mounted at ${now.toFixed(0)}ms. Rendering null.`);
    return null; 
  }
  
  const nowRender = performance.now();
  console.log(`[PW] IsolatedWalletProvider: Rendering full provider stack at ${nowRender.toFixed(0)}ms.`);
  return (
    <ConnectionProvider endpoint={rpcEndpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true}
        onError={(error) => {
          // Log wallet errors without crashing the application
          if (error.name === 'WalletNotReadyError') {
            console.debug('[PW] WalletProvider onError: WalletNotReadyError, will retry automatically');
            return;
          }
          if (error.name === 'WalletNotConnectedError') {
            // This is expected when no wallet is connected yet
            console.debug('[PW] WalletProvider onError: WalletNotConnectedError, user needs to connect manually');
            return;
          }
          if (error.name === 'WalletConnectionError') {
            // This typically happens when no wallet extension is installed
            console.warn('[PW] WalletProvider onError: WalletConnectionError:', error.message);
            console.info('[PW] To resolve this, install a Solana wallet extension like Phantom or Solflare');
            return;
          }
          if (error.name === 'WalletDisconnectedError') {
            console.info('[PW] WalletProvider onError: WalletDisconnectedError');
            return;
          }
          if (error.name === 'WalletAccountError') {
            console.warn('[PW] WalletProvider onError: WalletAccountError, wallet may need to be unlocked');
            return;
          }
          if (error.name === 'WalletPublicKeyError') {
            console.warn('[PW] WalletProvider onError: WalletPublicKeyError, cannot retrieve public key');
            return;
          }
          // Any other errors
          console.error('[PW] WalletProvider onError: Unknown error:', error);
        }}
        localStorageKey="solana-wallet-adapter-type"
      >
        <WalletModalProvider>
          <WalletReadyContext.Provider value={walletContextValue}>
            {children}
          </WalletReadyContext.Provider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
