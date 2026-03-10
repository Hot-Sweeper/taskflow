// TaskFlow — Data models, enums, and helpers

const STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in-progress',
  ON_HOLD: 'on-hold',
  NEEDS_INFO: 'needs-info',
  IN_REVIEW: 'in-review',
  DONE: 'done'
};

const STATUS_ORDER = [STATUS.TODO, STATUS.IN_PROGRESS, STATUS.ON_HOLD, STATUS.NEEDS_INFO, STATUS.IN_REVIEW, STATUS.DONE];

const STATUS_META = {
  [STATUS.TODO]:        { label: 'task.status.todo',     color: '#9CA3AF', icon: '○' },
  [STATUS.IN_PROGRESS]: { label: 'task.status.progress', color: '#3B82F6', icon: '◉' },
  [STATUS.ON_HOLD]:     { label: 'task.status.hold',     color: '#F59E0B', icon: '⏸' },
  [STATUS.NEEDS_INFO]:  { label: 'task.status.needsInfo', color: '#EF4444', icon: '❓' },
  [STATUS.IN_REVIEW]:   { label: 'task.status.review',   color: '#8B5CF6', icon: '👁' },
  [STATUS.DONE]:        { label: 'task.status.done',     color: '#10B981', icon: '✅' }
};

const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

const PRIORITY_META = {
  [PRIORITY.HIGH]:   { label: 'task.priority.high',   color: '#EF4444', icon: '🚩' },
  [PRIORITY.MEDIUM]: { label: 'task.priority.medium', color: '#F59E0B', icon: '🟧' },
  [PRIORITY.LOW]:    { label: 'task.priority.low',    color: '#3B82F6', icon: '🔵' }
};

const REQUEST_TYPES = ['approval', 'resource', 'decision', 'time-off', 'general'];
const REQUEST_STATUS = ['pending', 'approved', 'denied', 'info-needed'];

function relativeTime(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function deadlineDisplay(deadlineStr) {
  if (!deadlineStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineStr);
  deadline.setHours(0, 0, 0, 0);
  const diff = Math.ceil((deadline - now) / 86400000);

  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'overdue', urgent: true };
  if (diff === 0) return { text: 'Due today', cls: 'due-today', urgent: true };
  if (diff <= 3) return { text: `${diff}d left`, cls: 'due-soon', urgent: false };
  return { text: `${diff}d left`, cls: 'on-track', urgent: false };
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

if (typeof window !== 'undefined') {
  window.TaskModels = {
    STATUS, STATUS_ORDER, STATUS_META,
    PRIORITY, PRIORITY_META,
    REQUEST_TYPES, REQUEST_STATUS,
    relativeTime, deadlineDisplay, formatDuration, formatFileSize
  };
}
