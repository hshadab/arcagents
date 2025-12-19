'use client';

import { useState } from 'react';
import {
  Newspaper,
  Cloud,
  TrendingUp,
  Code,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  Activity,
  BarChart3,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ServiceOutputDisplayProps {
  data: unknown;
  serviceName?: string;
  serviceUrl?: string;
  className?: string;
}

// Type detection helpers
function isNewsData(data: unknown): data is NewsItem[] | { items: NewsItem[] } | { articles: NewsItem[] } | { news: NewsItem[] } {
  if (Array.isArray(data) && data.length > 0 && (data[0].title || data[0].headline || data[0].signal)) return true;
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.items) || Array.isArray(d.articles) || Array.isArray(d.news) || Array.isArray(d.data)) return true;
  }
  return false;
}

function isWeatherData(data: unknown): data is WeatherData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return 'temperature' in d || 'temp' in d || 'weather' in d || 'forecast' in d;
}

function isPriceData(data: unknown): data is PriceData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return 'price' in d || 'rate' in d || 'value' in d || ('bid' in d && 'ask' in d);
}

function isSignalData(data: unknown): data is SignalData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return 'signal' in d || 'signals' in d || 'recommendation' in d || 'action' in d || 'decision' in d;
}

function isSuccessResponse(data: unknown): data is { success: boolean; message?: string; data?: unknown } {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return 'success' in d && typeof d.success === 'boolean';
}

interface NewsItem {
  title?: string;
  headline?: string;
  description?: string;
  summary?: string;
  url?: string;
  link?: string;
  source?: string;
  publishedAt?: string;
  date?: string;
  timestamp?: number;
}

interface WeatherData {
  temperature?: number;
  temp?: number;
  humidity?: number;
  conditions?: string;
  weather?: string | { description: string };
  location?: string;
  city?: string;
}

interface PriceData {
  price?: number;
  rate?: number;
  value?: number;
  bid?: number;
  ask?: number;
  symbol?: string;
  currency?: string;
  change?: number;
  changePercent?: number;
}

interface SignalData {
  signal?: string;
  signals?: unknown[];
  recommendation?: string;
  action?: string;
  decision?: string;
  confidence?: number;
  score?: number;
  sentiment?: string;
  sentiment_value?: number;
}

function extractNewsItems(data: unknown): NewsItem[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.articles)) return d.articles;
    if (Array.isArray(d.news)) return d.news;
    if (Array.isArray(d.data)) return d.data;
  }
  return [];
}

function NewsDisplay({ items }: { items: NewsItem[] }) {
  const displayItems = items.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Newspaper className="w-4 h-4 text-blue-500" />
        News ({items.length} items)
      </div>
      <div className="space-y-2">
        {displayItems.map((item, i) => (
          <div
            key={i}
            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
          >
            <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {item.title || item.headline}
            </h5>
            {(item.description || item.summary) && (
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                {item.description || item.summary}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-500">
              {item.source && <span>{item.source}</span>}
              {(item.publishedAt || item.date) && (
                <span>{formatDate(item.publishedAt || item.date)}</span>
              )}
              {(item.url || item.link) && (
                <a
                  href={item.url || item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-arc-500 hover:underline flex items-center gap-1"
                >
                  Read <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          + {items.length - 5} more items
        </p>
      )}
    </div>
  );
}

function WeatherDisplay({ data }: { data: WeatherData }) {
  const temp = data.temperature ?? data.temp;
  const conditions = data.conditions || (typeof data.weather === 'string' ? data.weather : data.weather?.description);
  const location = data.location || data.city;

  return (
    <div className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Cloud className="w-5 h-5 text-blue-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Weather</span>
        {location && (
          <span className="text-xs text-gray-500 dark:text-gray-400">- {location}</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {temp !== undefined && (
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {Math.round(temp)}°
          </div>
        )}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {conditions && <div className="capitalize">{conditions}</div>}
          {data.humidity !== undefined && <div>Humidity: {data.humidity}%</div>}
        </div>
      </div>
    </div>
  );
}

function PriceDisplay({ data }: { data: PriceData }) {
  const price = data.price ?? data.rate ?? data.value;
  const isPositive = (data.change ?? 0) >= 0;

  return (
    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-5 h-5 text-green-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Price {data.symbol && `- ${data.symbol}`}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {price !== undefined && (
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {data.currency || '$'}{typeof price === 'number' ? price.toLocaleString() : price}
          </div>
        )}
        {data.change !== undefined && (
          <div className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{data.change}
            {data.changePercent !== undefined && ` (${data.changePercent}%)`}
          </div>
        )}
      </div>
      {data.bid !== undefined && data.ask !== undefined && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Bid: {data.bid} / Ask: {data.ask}
        </div>
      )}
    </div>
  );
}

function SignalDisplay({ data }: { data: SignalData }) {
  const signal = data.signal || data.recommendation || data.action || data.decision;
  const sentiment = data.sentiment;
  const confidence = data.confidence ?? data.score ?? data.sentiment_value;

  const getSignalColor = (sig: string | undefined) => {
    if (!sig) return 'gray';
    const lower = sig.toLowerCase();
    if (lower.includes('buy') || lower.includes('bullish') || lower.includes('long') || lower.includes('positive')) return 'green';
    if (lower.includes('sell') || lower.includes('bearish') || lower.includes('short') || lower.includes('negative')) return 'red';
    if (lower.includes('hold') || lower.includes('neutral')) return 'amber';
    return 'blue';
  };

  const color = getSignalColor(signal || sentiment);
  const colorClasses = {
    green: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800',
    red: 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800',
    amber: 'from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800',
    blue: 'from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 border-blue-200 dark:border-blue-800',
    gray: 'from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-800',
  };
  const textColors = {
    green: 'text-green-700 dark:text-green-300',
    red: 'text-red-700 dark:text-red-300',
    amber: 'text-amber-700 dark:text-amber-300',
    blue: 'text-blue-700 dark:text-blue-300',
    gray: 'text-gray-700 dark:text-gray-300',
  };

  return (
    <div className={`p-4 bg-gradient-to-br ${colorClasses[color]} rounded-lg border`}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className={`w-5 h-5 ${textColors[color]}`} />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Signal</span>
      </div>
      <div className="flex items-center gap-4">
        {signal && (
          <div className={`text-2xl font-bold uppercase ${textColors[color]}`}>
            {signal}
          </div>
        )}
        {sentiment && !signal && (
          <div className={`text-2xl font-bold capitalize ${textColors[color]}`}>
            {sentiment}
          </div>
        )}
        {confidence !== undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{Math.round(confidence * 100)}%</span> confidence
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessResponseDisplay({ data }: { data: { success: boolean; message?: string; data?: unknown } }) {
  return (
    <div className={`p-4 rounded-lg border ${
      data.success
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }`}>
      <div className="flex items-center gap-2">
        {data.success ? (
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        )}
        <span className={`font-medium ${
          data.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
        }`}>
          {data.success ? 'Success' : 'Failed'}
        </span>
      </div>
      {data.message && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {data.message}
        </p>
      )}
    </div>
  );
}

function DataSummary({ data }: { data: unknown }) {
  // Extract key stats from the data
  const stats: { label: string; value: string | number }[] = [];

  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;

    // Count arrays
    for (const [key, value] of Object.entries(d)) {
      if (Array.isArray(value)) {
        stats.push({ label: key, value: `${value.length} items` });
      } else if (typeof value === 'number') {
        stats.push({ label: key, value: value.toLocaleString() });
      } else if (typeof value === 'string' && value.length < 50) {
        stats.push({ label: key, value });
      }
    }
  }

  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
      {stats.slice(0, 6).map((stat, i) => (
        <div key={i} className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{stat.label.replace(/_/g, ' ')}</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

function JsonDisplay({ data, defaultCollapsed = true }: { data: unknown; defaultCollapsed?: boolean }) {
  const [showJson, setShowJson] = useState(!defaultCollapsed);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const jsonStr = JSON.stringify(data, null, 2);
  const isLarge = jsonStr.length > 500;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowJson(!showJson)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-arc-600 dark:hover:text-arc-400 transition-colors"
        >
          {showJson ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <Code className="w-4 h-4 text-purple-500" />
          {showJson ? 'Hide JSON' : 'View JSON'}
        </button>
        {showJson && (
          <button
            onClick={handleCopy}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
      {showJson && (
        <>
          <pre
            className={`p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto ${
              !expanded && isLarge ? 'max-h-40' : ''
            } overflow-y-hidden`}
          >
            {expanded || !isLarge ? jsonStr : jsonStr.slice(0, 500) + '...'}
          </pre>
          {isLarge && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-arc-500 hover:text-arc-600 flex items-center gap-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Show full response ({Math.round(jsonStr.length / 1024)}KB)
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function ServiceOutputDisplay({
  data,
  serviceName,
  serviceUrl,
  className = '',
}: ServiceOutputDisplayProps) {
  if (!data) {
    return (
      <div className={`p-4 text-center text-gray-500 dark:text-gray-400 ${className}`}>
        No data available
      </div>
    );
  }

  // Detect data type and render appropriate display
  const renderContent = () => {
    // Handle success/failure response wrapper
    if (isSuccessResponse(data)) {
      const innerData = data.data;
      const hasInnerData = innerData !== undefined && innerData !== null;
      return (
        <div className="space-y-3">
          <SuccessResponseDisplay data={data} />
          {hasInnerData ? (
            <>
              {renderInnerContent(innerData)}
              <JsonDisplay data={innerData} defaultCollapsed={true} />
            </>
          ) : (
            <JsonDisplay data={data} defaultCollapsed={true} />
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {renderInnerContent(data)}
        <JsonDisplay data={data} defaultCollapsed={true} />
      </div>
    );
  };

  // Render formatted content based on data type
  const renderInnerContent = (content: unknown) => {
    // Check for signal/decision data
    if (isSignalData(content)) {
      return <SignalDisplay data={content} />;
    }

    // Check for news data
    if (isNewsData(content)) {
      const items = extractNewsItems(content);
      if (items.length > 0) {
        return <NewsDisplay items={items} />;
      }
    }

    // Check for weather data
    if (isWeatherData(content)) {
      return <WeatherDisplay data={content} />;
    }

    // Check for price/trading data
    if (isPriceData(content)) {
      return <PriceDisplay data={content} />;
    }

    // Show data summary for objects
    return <DataSummary data={content} />;
  };

  return (
    <div className={`bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 ${className}`}>
      {(serviceName || serviceUrl) && (
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {serviceName || 'Service Output'}
          </span>
          {serviceUrl && (
            <a
              href={serviceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-arc-500 hover:underline flex items-center gap-1"
            >
              API <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
      {renderContent()}
    </div>
  );
}
