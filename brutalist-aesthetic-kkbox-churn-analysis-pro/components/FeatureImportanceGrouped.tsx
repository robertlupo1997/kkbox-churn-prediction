import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, PieChart, Pie } from 'recharts';
import { Zap, Filter, Search, Layers } from 'lucide-react';
import { featureImportance } from '../data/realData';

const CATEGORY_COLORS: Record<string, string> = {
  transaction: '#ff4d00',
  listening: '#000000',
  temporal: '#666666',
  demographic: '#22c55e',
  behavioral: '#3b82f6',
  other: '#a855f7'
};

const CATEGORY_LABELS: Record<string, string> = {
  transaction: 'Transaction',
  listening: 'Listening',
  temporal: 'Temporal',
  demographic: 'Demographic',
  behavioral: 'Behavioral',
  other: 'Other'
};

const FeatureImportanceGrouped: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCount, setShowCount] = useState(20);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(featureImportance.map(f => f.category))];
    return cats.sort((a, b) => {
      const order = ['transaction', 'listening', 'temporal', 'demographic', 'behavioral', 'other'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, []);

  // Category statistics for pie chart
  const categoryStats = useMemo(() => {
    return categories.map(cat => {
      const features = featureImportance.filter(f => f.category === cat);
      const totalImportance = features.reduce((sum, f) => sum + f.importance, 0);
      return {
        name: CATEGORY_LABELS[cat] || cat,
        category: cat,
        count: features.length,
        importance: totalImportance,
        percentage: (totalImportance / featureImportance.reduce((s, f) => s + f.importance, 0) * 100)
      };
    }).sort((a, b) => b.importance - a.importance);
  }, [categories]);

  // Filtered features
  const displayedFeatures = useMemo(() => {
    let filtered = featureImportance;

    if (selectedCategory) {
      filtered = filtered.filter(f => f.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f =>
        f.feature.toLowerCase().includes(term) ||
        f.description.toLowerCase().includes(term)
      );
    }

    return filtered.slice(0, showCount);
  }, [selectedCategory, searchTerm, showCount]);

  // Total features in current filter
  const totalFiltered = useMemo(() => {
    let filtered = featureImportance;
    if (selectedCategory) {
      filtered = filtered.filter(f => f.category === selectedCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f =>
        f.feature.toLowerCase().includes(term) ||
        f.description.toLowerCase().includes(term)
      );
    }
    return filtered.length;
  }, [selectedCategory, searchTerm]);

  return (
    <div className="space-y-8">
      {/* Category Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Pie Chart */}
        <div className="brutalist-border p-6 bg-white dark:bg-zinc-900">
          <h4 className="text-[9px] font-black uppercase tracking-widest mb-4 flex items-center dark:text-white">
            <Layers size={10} className="mr-1" /> Importance by Category
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryStats}
                  dataKey="importance"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  stroke="#000"
                  strokeWidth={1}
                  onClick={(data) => setSelectedCategory(
                    selectedCategory === data.category ? null : data.category
                  )}
                  style={{ cursor: 'pointer' }}
                >
                  {categoryStats.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={CATEGORY_COLORS[entry.category]}
                      opacity={selectedCategory && selectedCategory !== entry.category ? 0.3 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)}`, 'Total Importance']}
                  contentStyle={{
                    backgroundColor: '#000',
                    border: '2px solid #000',
                    borderRadius: 0,
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Stats */}
        <div className="lg:col-span-2 grid grid-cols-3 md:grid-cols-6 gap-2">
          {categoryStats.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setSelectedCategory(
                selectedCategory === cat.category ? null : cat.category
              )}
              className={`p-3 brutalist-border transition-all text-left ${
                selectedCategory === cat.category
                  ? 'bg-black text-white'
                  : 'bg-white dark:bg-zinc-800 hover:bg-light dark:hover:bg-zinc-700'
              }`}
            >
              <div
                className="w-full h-1 mb-2"
                style={{ backgroundColor: CATEGORY_COLORS[cat.category] }}
              />
              <p className={`text-[8px] font-black uppercase ${
                selectedCategory === cat.category ? 'text-white' : 'dark:text-white'
              }`}>
                {cat.name}
              </p>
              <p className={`text-lg font-black ${
                selectedCategory === cat.category ? 'text-brand' : 'dark:text-white'
              }`}>
                {cat.count}
              </p>
              <p className={`text-[8px] opacity-60 ${
                selectedCategory === cat.category ? 'text-white' : 'dark:text-white'
              }`}>
                {cat.percentage.toFixed(1)}%
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex brutalist-border flex-1">
          <div className="bg-black p-3 text-white flex items-center">
            <Search size={14} />
          </div>
          <input
            type="text"
            placeholder="SEARCH FEATURES..."
            className="flex-1 px-4 py-2 font-mono font-bold text-[10px] bg-white dark:bg-zinc-900 dark:text-white outline-none uppercase"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 text-[9px] font-black uppercase brutalist-border transition-all ${
              !selectedCategory ? 'bg-black text-white' : 'bg-white dark:bg-zinc-800 dark:text-white hover:bg-brand'
            }`}
          >
            <Filter size={10} className="inline mr-1" />
            All ({featureImportance.length})
          </button>
        </div>

        {/* Show count selector */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase dark:text-white">Show:</span>
          {[20, 50, 100, 131].map(n => (
            <button
              key={n}
              onClick={() => setShowCount(n)}
              className={`px-3 py-1 text-[9px] font-black brutalist-border ${
                showCount === n ? 'bg-black text-white' : 'bg-white dark:bg-zinc-800 dark:text-white'
              }`}
            >
              {n === 131 ? 'ALL' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Results info */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase opacity-60 dark:text-white">
          Showing {displayedFeatures.length} of {totalFiltered} features
          {selectedCategory && ` in ${CATEGORY_LABELS[selectedCategory]}`}
        </p>
        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-[9px] font-black uppercase text-brand hover:underline"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Feature Importance Chart */}
      <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
          <Zap size={10} className="mr-1" />
          {selectedCategory ? `${CATEGORY_LABELS[selectedCategory]} Features` : 'All Features'}
          <span className="ml-2 opacity-50">({displayedFeatures.length} shown)</span>
        </h3>

        {displayedFeatures.length > 0 ? (
          <div style={{ height: Math.max(400, displayedFeatures.length * 28) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayedFeatures}
                layout="vertical"
                margin={{ left: 20, right: 70, top: 0, bottom: 0 }}
              >
                <XAxis type="number" domain={[0, 1]} hide />
                <YAxis
                  dataKey="feature"
                  type="category"
                  width={180}
                  fontSize={9}
                  fontWeight={700}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.replace(/_/g, ' ').substring(0, 25)}
                  tick={{ fill: 'currentColor' }}
                />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-black text-white p-4 brutalist-border text-[10px] max-w-xs">
                        <p className="font-black uppercase text-brand">{data.feature}</p>
                        <p className="opacity-70 mt-1">{data.description}</p>
                        <div className="mt-2 pt-2 border-t border-white/20">
                          <p>Importance: <span className="text-brand font-black">{(data.importance * 100).toFixed(2)}%</span></p>
                          <p>Category: <span className="font-black">{CATEGORY_LABELS[data.category]}</span></p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="importance" stroke="#000" strokeWidth={1}>
                  {displayedFeatures.map((entry, index) => (
                    <Cell key={index} fill={CATEGORY_COLORS[entry.category] || '#ccc'} />
                  ))}
                  <LabelList
                    dataKey="importance"
                    position="right"
                    fontSize={9}
                    fontWeight={700}
                    formatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                    fill="currentColor"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-20 text-center brutalist-border border-dashed">
            <p className="text-[10px] font-black uppercase opacity-30 dark:text-white">
              No matching features found.
            </p>
          </div>
        )}
      </div>

      {/* Category Legend */}
      <div className="flex flex-wrap gap-4 justify-center">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={`flex items-center gap-2 px-3 py-1 brutalist-border transition-all ${
              selectedCategory === cat ? 'bg-black' : 'bg-white dark:bg-zinc-800'
            }`}
          >
            <div className="w-4 h-4 brutalist-border" style={{ backgroundColor: color }} />
            <span className={`text-[9px] font-black uppercase ${
              selectedCategory === cat ? 'text-white' : 'dark:text-white'
            }`}>
              {CATEGORY_LABELS[cat] || cat}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FeatureImportanceGrouped;
