import React from 'react';
import { IPTVProvider } from '@/lib/IPTVContext';
import IPTVApp from '@/pages/IPTVApp';

export default function Home() {
  return (
    <IPTVProvider>
      <IPTVApp />
    </IPTVProvider>
  );
}