import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <MobileHeader />
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}