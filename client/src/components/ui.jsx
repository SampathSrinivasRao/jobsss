import * as Dialog from '@radix-ui/react-dialog';
import { cva } from 'class-variance-authority';
import { LoaderCircle, X, Inbox } from 'lucide-react';
import { cn } from '../lib/utils';
const buttonVariants = cva('btn', { variants: { variant: { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' } }, defaultVariants: { variant: 'primary' } });
export function Button({ className, variant, children, type = 'button', ...props }) { return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props}>{children}</button>; }
export function Badge({ children, tone = 'gray', className }) { return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>; }
export function PageHeader({ eyebrow, title, description, actions }) { return <div className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p className="muted mt-2">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>; }
export function EmptyState({ icon: Icon = Inbox, title, description, action }) { return <div className="empty-state"><span className="empty-icon"><Icon size={28} /></span><h3>{title}</h3><p className="muted">{description}</p>{action}</div>; }
export function Field({ label, children, hint }) { return <label className="field"><span className="label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>; }
export function Spinner() { return <div className="loading-state" role="status"><LoaderCircle size={26} className="animate-spin" /><span>Loading…</span></div>; }
export function Modal({ open, onClose, title, children }) { return <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}><Dialog.Portal><Dialog.Overlay className="modal-overlay" /><Dialog.Content className="modal-content" aria-describedby={undefined}><div className="modal-header"><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label="Close dialog"><X size={20} /></button></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>; }
export function ErrorState({ message, onRetry }) { return <div className="error-state" role="alert"><p>{message}</p>{onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}</div>; }
