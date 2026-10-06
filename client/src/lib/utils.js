import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs) => twMerge(clsx(inputs));
export const idOf = (value) => value?._id || value?.id;
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
export function salary(job) {
  const format = (amount) => new Intl.NumberFormat('en', { style: 'currency', currency: job.currency || 'USD', notation: 'compact', maximumFractionDigits: 0 }).format(amount);
  return `${format(job.salaryMin || 0)} – ${format(job.salaryMax || 0)}`;
}
export function relativeDate(date) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date)) / 86400000));
  return days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;
}
