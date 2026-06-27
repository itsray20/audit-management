import React from 'react';
import ReactECharts from 'echarts-for-react';
import { 
  TrendingUp, TrendingDown, Package, ShieldCheck, 
  AlertTriangle, DollarSign, RefreshCw 
} from 'lucide-react';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(val || 0);
};

export default function Dashboard({ metrics, isDark }) {
  if (!metrics) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="animate-spin text-zinc-500 h-8 w-8" />
      </div>
    );
  }

  const kpis = [
    {
      title: 'Total Stock Value (System)',
      value: formatCurrency(metrics.totalStockValue),
      icon: Package,
      desc: 'Total value of items as per system records',
      trend: null
    },
    {
      title: 'Total Excess Value',
      value: formatCurrency(metrics.totalExcessValue),
      icon: TrendingUp,
      desc: 'Value of physical stock higher than system',
      trend: { text: '+Excess', isPositive: true }
    },
    {
      title: 'Total Shortage Value',
      value: formatCurrency(metrics.totalShortageValue),
      icon: TrendingDown,
      desc: 'Value of physical stock lower than system',
      trend: { text: '-Shortage', isPositive: false }
    },
    {
      title: 'Net Audit Difference',
      value: formatCurrency(metrics.totalExcessValue + metrics.totalShortageValue),
      icon: DollarSign,
      desc: 'Excess offset by Shortage value',
      trend: {
        text: (metrics.totalExcessValue + metrics.totalShortageValue) >= 0 ? '+Net Positive' : '-Net Negative',
        isPositive: (metrics.totalExcessValue + metrics.totalShortageValue) >= 0
      }
    },
    {
      title: 'Extra Found Value',
      value: formatCurrency(metrics.extraFoundValue),
      icon: ShieldCheck,
      desc: 'Items present but not listed in system',
      trend: { text: '+Extra Found', isPositive: true }
    },
    {
      title: 'Net Shortage',
      value: formatCurrency(metrics.netShortage),
      icon: AlertTriangle,
      desc: 'Net shortage after offsetting Extra Found',
      trend: {
        text: metrics.netShortage >= 0 ? '+Net Excess' : '-Net Deficit',
        isPositive: metrics.netShortage >= 0
      }
    }
  ];

  // ECharts theme styles
  const textColor = isDark ? '#fafafa' : '#09090b';
  const labelColor = isDark ? '#a1a1aa' : '#71717a';
  const gridBorderColor = isDark ? '#1e1e24' : '#e4e4e7';

  // 1. Category Breakdown Pie Chart
  const categoryData = Object.entries(metrics.categoryBreakdown || {})
    .map(([name, value]) => ({ name, value }))
    .filter(item => item.value > 0);

  const pieOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} items ({d}%)',
      backgroundColor: isDark ? '#0c0c0f' : '#ffffff',
      borderColor: gridBorderColor,
      textStyle: { color: textColor }
    },
    legend: {
      orient: 'horizontal',
      bottom: '0%',
      textStyle: { color: labelColor }
    },
    color: ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#6366f1'],
    series: [
      {
        name: 'Item Categories',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: isDark ? '#0c0c0f' : '#ffffff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '18',
            fontWeight: 'bold',
            color: textColor
          }
        },
        labelLine: {
          show: false
        },
        data: categoryData
      }
    ]
  };

  // 2. Location Breakdown Bar Chart (Top 10 Locations by absolute mismatch value)
  const locData = Object.entries(metrics.locationBreakdown || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 10);

  const barOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark ? '#0c0c0f' : '#ffffff',
      borderColor: gridBorderColor,
      textStyle: { color: textColor }
    },
    grid: {
      top: '10%',
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: labelColor },
      splitLine: { lineStyle: { color: gridBorderColor } }
    },
    yAxis: {
      type: 'category',
      data: locData.map(item => item.name),
      axisLabel: { color: labelColor }
    },
    series: [
      {
        name: 'Net Difference (INR)',
        type: 'bar',
        data: locData.map(item => {
          return {
            value: item.value,
            itemStyle: {
              color: item.value >= 0 ? '#10b981' : '#ef4444'
            }
          };
        })
      }
    ]
  };

  // 3. Supplier Breakdown Bar Chart (Top 10 Suppliers by absolute mismatch value)
  const supData = Object.entries(metrics.supplierBreakdown || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 10);

  const supplierOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDark ? '#0c0c0f' : '#ffffff',
      borderColor: gridBorderColor,
      textStyle: { color: textColor }
    },
    grid: {
      top: '10%',
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: supData.map(item => item.name),
      axisLabel: { color: labelColor, rotate: 30 }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: labelColor },
      splitLine: { lineStyle: { color: gridBorderColor } }
    },
    series: [
      {
        name: 'Net Difference (INR)',
        type: 'bar',
        data: supData.map(item => {
          return {
            value: item.value,
            itemStyle: {
              color: item.value >= 0 ? '#10b981' : '#ef4444'
            }
          };
        })
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div 
              key={idx}
              className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{kpi.title}</span>
                  <div className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-zinc-50">
                    {kpi.value}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                  <Icon className="h-5 w-5 text-zinc-500" />
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                <span>{kpi.desc}</span>
                {kpi.trend && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    kpi.trend.isPositive 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>
                    {kpi.trend.text}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Analytics Sections - 1 Chart Per Row for high readability */}
      <div className="grid grid-cols-1 gap-6">
        {/* Category Breakdown Card */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50 mb-4">Audit Result Categories Breakdown</h3>
          <div className="h-80">
            {categoryData.length > 0 ? (
              <ReactECharts option={pieOption} style={{ height: '100%' }} />
            ) : (
              <div className="flex justify-center items-center h-full text-zinc-500">
                No items counted yet.
              </div>
            )}
          </div>
        </div>

        {/* Location Breakdown Card */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50 mb-4">Top 10 Locations by Difference Value (INR)</h3>
          <div className="h-96">
            {locData.length > 0 ? (
              <ReactECharts option={barOption} style={{ height: '100%' }} />
            ) : (
              <div className="flex justify-center items-center h-full text-zinc-500">
                No differences logged.
              </div>
            )}
          </div>
        </div>

        {/* Supplier Breakdown Card */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50 mb-4">Top 10 Suppliers by Difference Value (INR)</h3>
          <div className="h-96">
            {supData.length > 0 ? (
              <ReactECharts option={supplierOption} style={{ height: '100%' }} />
            ) : (
              <div className="flex justify-center items-center h-full text-zinc-500">
                No differences logged.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
