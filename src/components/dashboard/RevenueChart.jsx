import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

const data = [
  { month: 'Jan', subs: 4200, donations: 2400, ads: 1800 },
  { month: 'Feb', subs: 4800, donations: 2100, ads: 2200 },
  { month: 'Mar', subs: 5100, donations: 3200, ads: 2400 },
  { month: 'Apr', subs: 5600, donations: 2800, ads: 2800 },
  { month: 'May', subs: 6200, donations: 3600, ads: 3200 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-xs font-medium" style={{ color: p.color }}>
            {p.name}: ${p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RevenueChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Revenue Breakdown</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly income sources</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[11px] text-muted-foreground">Subs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[11px] text-muted-foreground">Donations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-muted-foreground">Ads</span>
          </div>
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }}
              axisLine={{ stroke: 'hsl(222, 30%, 16%)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="subs" name="Subs" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="donations" name="Donations" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ads" name="Ads" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}