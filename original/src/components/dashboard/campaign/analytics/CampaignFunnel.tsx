"use client";

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';

interface CampaignFunnelProps {
  data: {
    sent: number;
    delivered: number;
    read: number;
    replied: number;
  };
  onFilter?: (status: string) => void;
}

export function CampaignFunnel({ data, onFilter }: CampaignFunnelProps) {
  const chartData = [
    { name: 'Sent', value: data.sent, color: '#3b82f6' },
    { name: 'Delivered', value: data.delivered, color: '#10b981' },
    { name: 'Read', value: data.read, color: '#6366f1' },
    { name: 'Replied', value: data.replied, color: '#8b5cf6' },
  ].filter(item => item.value > 0 || item.name === 'Sent');

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = data.sent > 0 ? ((item.value / data.sent) * 100).toFixed(1) : 0;
      
      return (
        <div className="bg-background border border-border p-3 rounded-2xl shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{item.name}</p>
          <p className="text-xl font-black">{item.value.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-primary mt-1">{percentage}% of total sent</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          barSize={60}
        >
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fontWeight: 900, fill: 'currentColor', opacity: 0.5 }}
            dy={10}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          <Bar dataKey="value" radius={[12, 12, 12, 12]} onClick={(data: any) => {
            if (onFilter) onFilter(data.name.toLowerCase());
          }}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color} 
                fillOpacity={0.8}
                className="cursor-pointer hover:fill-opacity-100 transition-all" 
              />
            ))}
            <LabelList 
                dataKey="value" 
                position="top" 
                style={{ fontSize: '12px', fontWeight: '900', fill: 'currentColor' }} 
                formatter={(val: any) => val ? val.toLocaleString() : ''}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
