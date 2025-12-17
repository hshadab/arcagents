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
} from 'lucide-react';

interface ServiceOutputDisplayProps {
  data: unknown;
  serviceName?: string;
  serviceUrl?: string;
  className?: string;
}

// Type detection helpers
function isNewsData(data: unknown): data is NewsItem[] | { items: NewsItem[] } | { articles: NewsItem[] } | { news: NewsItem[] } {
  if (Array.isArray(data) && data.length > 0 && (data[0].title || data[0].headline)) return true;
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.items) || Array.isArray(d.articles) || Array.isArray(d.news)) return true;
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

function JsonDisplay({ data }: { data: unknown }) {
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
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Code className="w-4 h-4 text-purple-500" />
          JSON Response
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
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
    // Check for news data first
    if (isNewsData(data)) {
      const items = extractNewsItems(data);
      if (items.length > 0) {
        return <NewsDisplay items={items} />;
      }
    }

    // Check for weather data
    if (isWeatherData(data)) {
      return <WeatherDisplay data={data} />;
    }

    // Check for price/trading data
    if (isPriceData(data)) {
      return <PriceDisplay data={data} />;
    }

    // Default to JSON display
    return <JsonDisplay data={data} />;
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
