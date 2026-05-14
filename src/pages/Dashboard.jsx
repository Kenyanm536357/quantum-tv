import React from 'react';
import { Eye, Users, DollarSign, Heart, Sparkles } from 'lucide-react';
import StatsCard from '../components/dashboard/StatsCard';
import LiveStreamPanel from '../components/dashboard/LiveStreamPanel';
import ViewerChart from '../components/dashboard/ViewerChart';
import RecentStreams from '../components/dashboard/RecentStreams';
import TopChannels from '../components/dashboard/TopChannels';
import QuickActions from '../components/dashboard/QuickActions';
import ChatPreview from '../components/dashboard/ChatPreview';
import RevenueChart from '../components/dashboard/RevenueChart';

const stats = [
  { title: 'Live Viewers', value: '12,847', change: 23.5, changeLabel: 'vs last stream', icon: Eye, iconColor: 'bg-primary/10 text-primary' },
  { title: 'Subscribers', value: '284.3K', change: 12.1, changeLabel: '+2.4K this month', icon: Users, iconColor: 'bg-accent/10 text-accent' },
  { title: 'Revenue', value: '$18,420', change: 8.7, changeLabel: 'May 2026', icon: DollarSign, iconColor: 'bg-emerald-500/10 text-emerald-400' },
  { title: 'Engagement', value: '94.2%', change: -1.3, changeLabel: 'Avg. interaction rate', icon: Heart, iconColor: 'bg-pink-500/10 text-pink-400' },
];

export default function Dashboard() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back — your stream is live</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Stream Health: Excellent</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <StatsCard key={stat.title} {...stat} delay={i * 0.05} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Stream + Charts */}
        <div className="xl:col-span-2 space-y-6">
          <LiveStreamPanel />
          <ViewerChart />
          <RevenueChart />
        </div>

        {/* Right Column - Sidebar Widgets */}
        <div className="space-y-6">
          <QuickActions />
          <ChatPreview />
          <RecentStreams />
          <TopChannels />
        </div>
      </div>
    </div>
  );
}