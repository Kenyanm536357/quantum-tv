import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const data = [
  { time: '00:00', viewers: 2400 },
  { time: '02:00', viewers: 1398 },
  { time: '04:00', viewers: 800 },
  { time: '06:00', viewers: 1200 },
  { time: '08:00', viewers: 3908 },
  { time: '10:00', viewers: 6800 },
  { time: '12:00', viewers: 8200 },
  { time: '14:00', viewers: 9800 },
  { time: '16:00', viewers: 11200 },
  { time: '18:00', viewers: 14800 },
  { time: '20:00', viewers: 18200 },
  { time: '22:00', viewers: 15400 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-primary">{payload[0].value.toLocaleString()} viewers</p>
      </div>
    );
  }
  return null;
};

export default function ViewerChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Viewer Activity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Last 24 hours</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
          <button className="px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground">24h</button>
          <button className="px-3 py-1 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground transition-colors">7d</button>
          <button className="px-3 py-1 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground transition-colors">30d</button>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="viewerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }}
              axisLine={{ stroke: 'hsl(222, 30%, 16%)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="viewers"
              stroke="hsl(199, 89%, 48%)"
              strokeWidth={2}
              fill="url(#viewerGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}