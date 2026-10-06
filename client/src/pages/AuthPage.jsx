import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { BriefcaseBusiness, Check, Eye, EyeOff, LoaderCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Brand } from '../components/Layout';
import { Button, Field } from '../components/ui';

export default function AuthPage() {
  const { role, mode } = useParams();
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const employer = role === 'employer';
  const signup = mode === 'register';
  if (!['seeker', 'employer'].includes(role) || !['login', 'register'].includes(mode)) return <Navigate to="/auth/seeker/login" replace />;
  if (user) return <Navigate to={user.role === 'employer' ? '/employer' : '/'} replace />;
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await (signup ? register({ ...values, role }) : login({ email: values.email, password: values.password, role })); navigate(employer ? '/employer' : '/', { replace: true }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-story"><Brand /><div className="auth-story-content"><span className="auth-label"><Sparkles size={16} />Your next chapter</span><h1>{employer ? <>Good people.<br />Great possibilities.</> : <>Find work that<br />feels like you.</>}</h1><p>{employer ? 'A thoughtful workspace for every step of hiring, from your first opening to your next great teammate.' : 'Discover opportunities that match your skills, your ambitions, and the way you want to work.'}</p><div className="auth-checks">{(employer ? ['Your company, beautifully presented', 'Every candidate, one clear pipeline', 'Better job descriptions with AI'] : ['Opportunities matched to your skills', 'Your profile. One-click applications.', 'Every application, in one place']).map((text) => <div key={text}><Check size={18} />{text}</div>)}</div></div><div className="auth-story-footer"><BriefcaseBusiness size={18} />Make your next move with Hirelane.</div></div><div className="auth-form-panel"><Link to="/" className="auth-back">Browse opportunities</Link><div className="auth-form-inner"><div className="eyebrow">{employer ? 'FOR HIRING TEAMS' : 'FOR JOB SEEKERS'}</div><h2>{signup ? 'A fresh start awaits.' : 'Welcome back.'}</h2><p className="muted">{signup ? 'Create an account and make your next move.' : `Sign in to your ${employer ? 'employer' : 'job seeker'} workspace.`}</p><div className="auth-role-tabs"><Link className={!employer ? 'selected' : ''} to={`/auth/seeker/${mode}`}>Job seeker</Link><Link className={employer ? 'selected' : ''} to={`/auth/employer/${mode}`}>Employer</Link></div><form onSubmit={submit} className="page-stack">{signup && <Field label="Full name"><input autoComplete="name" required maxLength={100} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} placeholder="Alex Morgan" /></Field>}<Field label="Email address"><input type="email" autoComplete="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} placeholder="you@example.com" /></Field><Field label="Password" hint={signup ? 'At least 10 characters, including uppercase, lowercase, and a number.' : undefined}><div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 10 : 1} maxLength={128} value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} placeholder={signup ? 'Create a secure password' : 'Enter your password'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></Field>{error && <div className="inline-error" role="alert">{error}</div>}<Button type="submit" disabled={busy} className="w-full">{busy && <LoaderCircle size={18} className="animate-spin" />}{signup ? 'Create account' : 'Sign in'}</Button></form><p className="auth-switch">{signup ? 'Already have an account?' : 'New to Hirelane?'} <Link to={`/auth/${role}/${signup ? 'login' : 'register'}`}>{signup ? 'Sign in' : 'Create an account'}</Link></p></div><p className="auth-fineprint">Your next opportunity starts with a conversation.</p></div></div>;
}
