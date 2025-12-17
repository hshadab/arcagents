import { NextRequest, NextResponse } from 'next/server';

// In production, use Redis or a database
// For demo, we use in-memory storage
const executionLogs: ExecutionLog[] = [];

interface ExecutionLog {
  id: string;
  agentId: string;
  agentName: string;
  timestamp: number;
  success: boolean;
  serviceUrl: string;
  serviceName: string;
  amountPaid?: string;
  proofHash?: string;
  proofSubmitted?: boolean;
  proofTxHash?: string;
  error?: string;
  durationMs: number;
  response?: unknown;
}

/**
 * GET /api/activity - Get execution logs
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let logs = executionLogs;

  // Filter by agent if specified
  if (agentId) {
    logs = logs.filter((log) => log.agentId === agentId);
  }

  // Sort by timestamp descending (newest first)
  logs = logs.sort((a, b) => b.timestamp - a.timestamp);

  // Paginate
  const total = logs.length;
  const paginatedLogs = logs.slice(offset, offset + limit);

  return NextResponse.json({
    logs: paginatedLogs,
    total,
    limit,
    offset,
  });
}

/**
 * POST /api/activity - Record an execution log
 */
export async function POST(request: NextRequest) {
  try {
    const log = (await request.json()) as ExecutionLog;

    // Validate required fields
    if (!log.agentId || !log.timestamp) {
      return NextResponse.json(
        { error: 'agentId and timestamp are required' },
        { status: 400 }
      );
    }

    // Generate ID if not provided
    if (!log.id) {
      log.id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    // Add to logs (prepend for performance)
    executionLogs.unshift(log);

    // Keep only last 1000 logs in memory
    if (executionLogs.length > 1000) {
      executionLogs.pop();
    }

    return NextResponse.json({ success: true, id: log.id });
  } catch (error) {
    console.error('Failed to record execution log:', error);
    return NextResponse.json(
      { error: 'Failed to record log' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/activity - Clear logs (admin only)
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  if (agentId) {
    // Remove logs for specific agent
    const initialLength = executionLogs.length;
    const filtered = executionLogs.filter((log) => log.agentId !== agentId);
    executionLogs.length = 0;
    executionLogs.push(...filtered);
    return NextResponse.json({
      success: true,
      removed: initialLength - executionLogs.length,
    });
  } else {
    // Clear all logs
    const count = executionLogs.length;
    executionLogs.length = 0;
    return NextResponse.json({ success: true, removed: count });
  }
}
