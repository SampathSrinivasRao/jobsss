import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, BriefcaseBusiness, Building2, CheckCircle2, Sparkles, ChevronLeft, ExternalLink, LoaderCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, ErrorState, Spinner } from '../../components/ui';
import { salary, relativeDate } from '../../lib/utils';
import { CompanyLogo } from './Jobs';

export default function JobDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { const controller = new AbortController(); setJob(null); setError(''); setApplied(false); api.get(`/jobs/${id}`, { signal: controller.signal }).then((data) => { setJob(data); setApplied(Boolean(data.hasApplied)); }).catch((err) => { if (err.name !== 'AbortError') setError(err.message); }); return () => controller.abort(); }, [id, retry]);
  async function apply() { setBusy(true); try { await api.post(`/jobs/${id}/apply`); setApplied(true); toast('Application sent. Your next chapter is on its way.'); } catch (err) { if (err.status === 409) setApplied(true); toast(err.message, 'error'); } finally { setBusy(false); } }
  if (error) return <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />;
  if (!job) return <Spinner />;
  return <div className="page-stack"><Link to="/" className="back-link"><ChevronLeft size={17} />All opportunities</Link><div className="detail-header card"><div className="flex items-start gap-5"><CompanyLogo company={job.company} /><div><span className="company-name">{job.company?.name}</span><h1 className="mt-1">{job.title}</h1><div className="job-meta mt-4"><span><MapPin size={16} />{job.location}</span><span><Building2 size={16} />{job.jobType}</span><span><BriefcaseBusiness size={16} />{job.employmentType}</span></div></div></div><Badge tone="green">{job.experienceLevel} level</Badge></div><div className="detail-grid"><div className="page-stack"><section className="card detail-section"><h2>About this opportunity</h2><div className="job-description">{job.description}</div><h2 className="mt-8">Skills you’ll bring</h2><div className="flex flex-wrap gap-2 mt-4">{job.skills?.map((skill) => <Badge key={skill} tone={job.matchedSkills?.includes(skill) ? 'green' : 'gray'}>{skill}</Badge>)}</div></section><section className="card detail-section"><h2>Meet {job.company?.name}</h2><p className="muted mt-4 whitespace-pre-line">{job.company?.description || 'Explore this opportunity and learn more about the team during your interview.'}</p><div className="flex flex-wrap gap-3 mt-4">{job.company?.industry && <Badge>{job.company.industry}</Badge>}{job.company?.website && <a className="text-link" href={job.company.website} target="_blank" rel="noopener noreferrer">Company website<ExternalLink size={15} /></a>}</div></section></div><aside className="card apply-card"><span className="eyebrow">YOUR NEXT OPPORTUNITY</span><h2>{salary(job)}</h2><p className="muted">Annual salary · {job.currency || 'USD'}</p><div className="apply-divider" />{typeof job.matchScore === 'number' && user?.role === 'seeker' && <div className="detail-match"><Sparkles size={22} /><div><strong>{job.matchScore}% skills match</strong><p>Based on the skills in your profile.</p></div></div>}{user?.role === 'seeker' ? <><Button className="w-full" onClick={apply} disabled={busy || applied || job.status !== 'active'}>{busy ? <LoaderCircle size={18} className="animate-spin" /> : applied ? <CheckCircle2 size={18} /> : null}{applied ? 'Application submitted' : job.status !== 'active' ? 'Applications closed' : 'Apply in one click'}</Button><p className="field-hint mt-3">We’ll share your saved profile and resume with this employer.</p><Link className="text-link mt-4" to={applied ? '/seeker/applications' : '/seeker/profile'}>{applied ? 'Track your application' : 'Review your profile'}</Link></> : !user ? <Link className="btn btn-primary w-full" to="/auth/seeker/login">Sign in to apply</Link> : <p className="muted">You’re viewing this role as an employer.</p>}<div className="apply-divider" /><p className="muted text-sm">Posted {relativeDate(job.createdAt).toLowerCase()}</p></aside></div></div>;
}
