'use client';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
}

const colorMap = {
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', iconBg: 'bg-indigo-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', iconBg: 'bg-emerald-100' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', iconBg: 'bg-amber-100' },
  rose: { bg: 'bg-rose-50', icon: 'text-rose-600', iconBg: 'bg-rose-100' },
};

export function StatsCard({ title, value, subValue, icon: Icon, trend, color }: StatsCardProps) {
  const colors = colorMap[color];
  const isPositive = trend && trend.value >= 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subValue && <p className="text-sm text-gray-400 mt-0.5">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colors.iconBg}`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1">
          <span className={`text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(trend.value)}%
          </span>
          <span className="text-sm text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
