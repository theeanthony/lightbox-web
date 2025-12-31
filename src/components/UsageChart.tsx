"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { day: "01 Feb", amount: 0 },
  { day: "02 Feb", amount: 0 },
  { day: "03 Feb", amount: 0 },
  { day: "04 Feb", amount: 0 },
  { day: "05 Feb", amount: 0 },
  { day: "06 Feb", amount: 0 },
  { day: "07 Feb", amount: 0 },
  { day: "08 Feb", amount: 0 },
  { day: "09 Feb", amount: 0 },
  { day: "10 Feb", amount: 45 },
  { day: "11 Feb", amount: 0 },
  { day: "12 Feb", amount: 0 },
];

export function UsageChart() {
  return (
    // FIX: Changed "mt-4" to a specific pixel height wrapper
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={40}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis 
            dataKey="day" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} 
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip 
            cursor={{ fill: 'var(--color-muted)' }}
            contentStyle={{ 
              backgroundColor: 'var(--color-popover)', 
              borderColor: 'var(--color-border)', 
              color: 'var(--color-popover-foreground)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
            }}
          />
          <Bar dataKey="amount" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}