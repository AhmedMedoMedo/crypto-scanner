export const formatDuration = (ms?: number): string => {
  if (!ms || isNaN(ms) || ms < 0) return '0د';
  const mins = Math.max(1, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}د`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}س و ${remainingMins}د`;
};

export const formatTimeAgo = (openTimeMs?: number): string => {
  if (!openTimeMs) return '';
  const now = Date.now();
  const diffMs = now - openTimeMs;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'منذ لحظات';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours < 24) return remainingMins === 0 ? `منذ ${hours} ساعة` : `منذ ${hours}س و ${remainingMins}د`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
};

export const getScoreColorClass = (score: number) => {
  if (score >= 85) return { text: 'text-brand-green', bg: 'bg-brand-green' };
  if (score >= 70) return { text: 'text-brand-blue', bg: 'bg-brand-blue' };
  if (score >= 55) return { text: 'text-brand-gold', bg: 'bg-brand-gold' };
  return { text: 'text-brand-red', bg: 'bg-brand-red' };
};
