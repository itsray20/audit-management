import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { 
  TrendingUp, TrendingDown, Package, ShieldCheck, 
  AlertTriangle, DollarSign, RefreshCw, CalendarRange, MapPin, Truck, CheckCircle2, ChevronRight
} from 'lucide-react';

const formatCurrency = (val) => {
  const num = Number(val || 0);
  if (num < 0) {
    return '-₹' + Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

export default function Dashboard({ metrics, isDark }) {
  const [discrepancyTab, setDiscrepancyTab] = useState('shortages');

  if (!metrics) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="animate-spin text-blue-500 h-8 w-8" />
      </div>
    );
  }

  const completionRate = metrics.totalItems > 0 
    ? (metrics.itemsAudited / metrics.totalItems) * 100 
    : 0;

  const kpis = [
    {
      title: 'Total Stock Value (System)',
      value: formatCurrency(metrics.totalStockValue),
      icon: Package,
      desc: 'Recorded value prior to reconciliation',
      color: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1c1c1e]',
      iconBg: 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400',
      trend: null
    },
    {
      title: 'Total Excess Value',
      value: '+' + formatCurrency(metrics.totalExcessValue),
      icon: TrendingUp,
      desc: 'Surpluses logged on existing batches',
      color: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1c1c1e]',
      iconBg: 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400',
      trend: { text: 'Surpluses', isPositive: true }
    },
    {
      title: 'Total Shortage Value',
      value: formatCurrency(metrics.totalShortageValue),
      icon: TrendingDown,
      desc: 'Recorded losses on missing items',
      color: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1c1c1e]',
      iconBg: 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400',
      trend: { text: 'Shortages', isPositive: false }
    },
    {
      title: 'Extra Found Value',
      value: '+' + formatCurrency(metrics.extraFoundVal || metrics.extraFoundValue),
      icon: ShieldCheck,
      desc: 'Physical items missing in system file',
      color: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1c1c1e]',
      iconBg: 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400',
      trend: { text: 'Unregistered', isPositive: true }
    },
    {
      title: 'Net Shortage',
      value: formatCurrency(metrics.netShortage),
      icon: AlertTriangle,
      desc: 'Shortage balanced by extra found',
      color: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1c1c1e]',
      iconBg: 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400',
      trend: {
        text: metrics.netShortage >= 0 ? 'Balanced Surplus' : 'Net Deficit',
        isPositive: metrics.netShortage >= 0
      }
    },
    {
      title: 'Net Audit Variance',
      value: (metrics.netAuditDifference >= 0 ? '+' : '') + formatCurrency(metrics.netAuditDifference),
      icon: DollarSign,
      desc: 'Absolute financial audit result',
      color: metrics.netAuditDifference >= 0
        ? 'border-zinc-200 dark:border-zinc-850 bg-white dark:bg-[#1c1c1e] text-[#0071e3] dark:text-[#0a84ff]'
        : 'border-zinc-200 dark:border-zinc-850 bg-white dark:bg-[#1c1c1e] text-rose-600 dark:text-rose-450',
      iconBg: 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400',
      trend: {
        text: metrics.netAuditDifference >= 0 ? 'Financial Surplus' : 'Financial Shortfall',
        isPositive: metrics.netAuditDifference >= 0
      }
    },
    {
      title: 'Expiry Stock Value',
      value: formatCurrency(metrics.expiredValue),
      icon: CalendarRange,
      desc: 'Physical stock verified as expired',
      color: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1c1c1e]',
      iconBg: 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400',
      trend: { text: 'Expired', isPositive: false }
    }
  ];

  // Theme Configs
  const textColor = isDark ? '#fafafa' : '#09090b';
  const labelColor = isDark ? '#a1a1aa' : '#71717a';
  const gridBorderColor = isDark ? '#1e1e24' : '#e4e4e7';

  // Pie Chart: Category Breakdown
  const categoryData = Object.entries(metrics.categoryBreakdown || {})
    .map(([name, value]) => ({ name, value }))
    .filter(item => item.value > 0);

  const pieOption = {
    baseOption: {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} items ({d}%)',
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        borderColor: gridBorderColor,
        textStyle: { color: textColor }
      },
      legend: {
        orient: 'vertical',
        right: '10%',
        top: 'center',
        textStyle: { color: labelColor, fontSize: 11, fontWeight: '600' },
        icon: 'circle',
        itemGap: 12
      },
      color: ['#34c759', '#ff3b30', '#0071e3', '#ff9500', '#af52de', '#8e8e93'],
      series: [
        {
          name: 'Item Status',
          type: 'pie',
          radius: ['55%', '80%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: isDark ? '#09090b' : '#ffffff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          data: categoryData
        }
      ]
    },
    media: [
      {
        query: { maxWidth: 480 },
        option: {
          legend: {
            orient: 'horizontal',
            left: 'center',
            bottom: '5%',
            top: 'auto',
            right: 'auto',
            itemGap: 8
          },
          series: [
            {
              center: ['50%', '38%'],
              radius: ['45%', '65%']
            }
          ]
        }
      }
    ]
  };

  // Donut Chart: Expiry Risk
  const expMetrics = metrics.expiryBreakdown || { expired: { value: 0 }, nearExpiry: { value: 0 }, goodStock: { value: 0 } };
  const expiryData = [
    { name: 'GOOD STOCK', value: expMetrics.goodStock.value },
    { name: 'NEAR EXPIRY', value: expMetrics.nearExpiry.value },
    { name: 'EXPIRED', value: expMetrics.expired.value }
  ].filter(d => d.value > 0);

  const expiryOption = {
    baseOption: {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: ₹{c} ({d}%)',
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        borderColor: gridBorderColor,
        textStyle: { color: textColor }
      },
      legend: {
        orient: 'vertical',
        right: '10%',
        top: 'center',
        textStyle: { color: labelColor, fontSize: 11, fontWeight: '600' },
        icon: 'circle',
        itemGap: 12
      },
      color: ['#34c759', '#ff9500', '#ff3b30'],
      series: [
        {
          name: 'Expiry Risk',
          type: 'pie',
          radius: ['55%', '80%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: isDark ? '#09090b' : '#ffffff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          data: expiryData
        }
      ]
    },
    media: [
      {
        query: { maxWidth: 480 },
        option: {
          legend: {
            orient: 'horizontal',
            left: 'center',
            bottom: '5%',
            top: 'auto',
            right: 'auto',
            itemGap: 8
          },
          series: [
            {
              center: ['50%', '38%'],
              radius: ['45%', '65%']
            }
          ]
        }
      }
    ]
  };


  // Bar Chart: Location Breakdown with Gradient colors
  const locData = Object.entries(metrics.locationBreakdown || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 10);

  const locationOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      borderColor: gridBorderColor,
      textStyle: { color: textColor }
    },
    grid: { top: '8%', left: '3%', right: '4%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: labelColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridBorderColor } }
    },
    yAxis: {
      type: 'category',
      data: locData.map(item => item.name).reverse(),
      axisLabel: { color: labelColor, fontSize: 10 }
    },
    series: [
      {
        name: 'Variance (INR)',
        type: 'bar',
        barWidth: '50%',
        itemStyle: { borderRadius: 4 },
        data: locData.map(item => ({
          value: item.value,
          itemStyle: {
            color: item.value >= 0 
              ? {
                  type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#047857' }]
                }
              : {
                  type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                  colorStops: [{ offset: 0, color: '#f43f5e' }, { offset: 1, color: '#be123c' }]
                }
          }
        })).reverse()
      }
    ]
  };

  // Bar Chart: Supplier Breakdown with Gradient colors
  const supData = Object.entries(metrics.supplierBreakdown || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8);

  const supplierOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      borderColor: gridBorderColor,
      textStyle: { color: textColor }
    },
    grid: { top: '10%', left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: supData.map(item => item.name),
      axisLabel: { color: labelColor, rotate: 20, fontSize: 9 }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: labelColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridBorderColor } }
    },
    series: [
      {
        name: 'Variance (INR)',
        type: 'bar',
        barWidth: '40%',
        itemStyle: { borderRadius: 4 },
        data: supData.map(item => ({
          value: item.value,
          itemStyle: {
            color: item.value >= 0 
              ? {
                  type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#0891b2' }]
                }
              : {
                  type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [{ offset: 0, color: '#f43f5e' }, { offset: 1, color: '#be123c' }]
                }
          }
        }))
      }
    ]
  };

  return (
    <div className="space-y-6">
      

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div 
              key={idx}
              className="metric-card rounded-2xl p-5 transition-all duration-300"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{kpi.title}</span>
                  <div className="text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-white mt-1">
                    {kpi.value}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/50">
                  <Icon className="h-4.5 w-4.5" style={{ color: 'var(--accent)' }} />
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center text-[10px]">
                <span className="text-zinc-400 dark:text-zinc-500">{kpi.desc}</span>
                {kpi.trend && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    kpi.trend.isPositive 
                      ? 'bg-emerald-100/60 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' 
                      : 'bg-rose-100/60 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                  }`}>
                    {kpi.trend.text}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Discrepancy Tabbed Lists Widget */}
      <div className="panel-card rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4 gap-3">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Critical Variance Risk Items</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">High-value discrepancy items requiring immediate review.</p>
          </div>
          <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-full p-0.5 border border-zinc-200 dark:border-zinc-800 text-xs shadow-inner">
            <button 
              onClick={() => setDiscrepancyTab('shortages')}
              className={`px-4 py-1.5 font-semibold rounded-full transition-all ${
                discrepancyTab === 'shortages' 
                  ? 'bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-450 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Shortages (Losses)
            </button>
            <button 
              onClick={() => setDiscrepancyTab('excesses')}
              className={`px-4 py-1.5 font-semibold rounded-full transition-all ${
                discrepancyTab === 'excesses' 
                  ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Excesses (Surpluses)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {discrepancyTab === 'shortages' ? (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2.5 font-semibold">Product Name</th>
                  <th className="py-2.5 font-semibold">Batch ID</th>
                  <th className="py-2.5 font-semibold">Expiry</th>
                  <th className="py-2.5 text-center font-semibold">Sys Qty</th>
                  <th className="py-2.5 text-center font-semibold">Phy Qty</th>
                  <th className="py-2.5 text-center font-semibold">Diff</th>
                  <th className="py-2.5 text-right font-semibold">Loss Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                {metrics.topShortages && metrics.topShortages.length > 0 ? (
                  metrics.topShortages.map((item, index) => (
                    <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20">
                      <td className="py-3 font-semibold text-zinc-900 dark:text-zinc-100">{item.item_name}</td>
                      <td className="py-3 font-mono text-zinc-500 dark:text-zinc-400">{item.batch_no || '—'}</td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">{item.expiry_date || '—'}</td>
                      <td className="py-3 text-center text-zinc-700 dark:text-zinc-300 font-mono">{item.system_qty}</td>
                      <td className="py-3 text-center text-zinc-900 dark:text-zinc-50 font-mono font-semibold">{item.totalPhysical}</td>
                      <td className="py-3 text-center text-rose-500 font-bold font-mono">{item.difference}</td>
                      <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-bold font-mono">{formatCurrency(item.differenceValue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-400">No shortage items logged.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2.5 font-semibold">Product Name</th>
                  <th className="py-2.5 font-semibold">Batch ID</th>
                  <th className="py-2.5 font-semibold">Expiry</th>
                  <th className="py-2.5 text-center font-semibold">Sys Qty</th>
                  <th className="py-2.5 text-center font-semibold">Phy Qty</th>
                  <th className="py-2.5 text-center font-semibold">Diff</th>
                  <th className="py-2.5 text-right font-semibold">Surplus Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                {metrics.topExcesses && metrics.topExcesses.length > 0 ? (
                  metrics.topExcesses.map((item, index) => (
                    <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20">
                      <td className="py-3 font-semibold text-zinc-900 dark:text-zinc-100">{item.item_name}</td>
                      <td className="py-3 font-mono text-zinc-500 dark:text-zinc-400">{item.batch_no || '—'}</td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">{item.expiry_date || '—'}</td>
                      <td className="py-3 text-center text-zinc-700 dark:text-zinc-300 font-mono">{item.system_qty}</td>
                      <td className="py-3 text-center text-zinc-900 dark:text-zinc-50 font-mono font-semibold">{item.totalPhysical}</td>
                      <td className="py-3 text-center text-emerald-500 font-bold font-mono">+{item.difference}</td>
                      <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold font-mono">+{formatCurrency(item.differenceValue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-400">No excess items logged.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category breakdown Card */}
        <div className="panel-card rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-blue-500" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Audit Categories Breakdown</h4>
          </div>
          <div className="h-[300px] flex-1">
            {categoryData.length > 0 ? (
              <ReactECharts option={pieOption} style={{ height: '300px', width: '100%' }} />
            ) : (
              <div className="flex justify-center items-center h-full text-zinc-500 dark:text-zinc-400 text-xs">No items counted yet.</div>
            )}
          </div>
        </div>

        {/* Expiry breakdown Card */}
        <div className="panel-card rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <CalendarRange className="h-4 w-4 text-purple-500" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Expiry Stock Value Distribution</h4>
          </div>
          <div className="h-[300px] flex-1">
            {expiryData.length > 0 ? (
              <ReactECharts option={expiryOption} style={{ height: '300px', width: '100%' }} />
            ) : (
              <div className="flex justify-center items-center h-full text-zinc-500 dark:text-zinc-400 text-xs font-medium">No expiry dates found in dataset.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
