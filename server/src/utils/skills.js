const aliases = {
  'react.js': 'react', reactjs: 'react', 'node.js': 'node', nodejs: 'node',
  'express.js': 'express', expressjs: 'express', 'vue.js': 'vue', vuejs: 'vue',
  'next.js': 'nextjs', 'next js': 'nextjs', postgres: 'postgresql',
  'amazon web services': 'aws', 'google cloud': 'gcp', 'c sharp': 'c#',
};

export function normalizeSkill(skill) {
  const key = skill.trim().toLowerCase();
  return aliases[key] || key;
}

export function matchSkills(required = [], available = []) {
  const profile = new Set(available.map(normalizeSkill));
  const unique = [...new Map(required.map(s => [normalizeSkill(s), s])).values()];
  const matchedSkills = unique.filter(s => profile.has(normalizeSkill(s)));
  return {
    matchScore: unique.length ? Math.round(matchedSkills.length / unique.length * 100) : 0,
    matchedSkills,
    missingSkills: unique.filter(s => !profile.has(normalizeSkill(s))),
    matchMethod: 'Required-skill overlap. Skills count equally; this is an explainable heuristic, not an AI hiring decision.',
  };
}

const vocabulary = ['JavaScript', 'TypeScript', 'React', 'React.js', 'Node.js', 'Express', 'MongoDB', 'SQL', 'PostgreSQL', 'MySQL', 'Python', 'Java', 'C++', 'C#', 'HTML', 'CSS', 'Tailwind CSS', 'Next.js', 'Vue', 'Angular', 'Redux', 'REST', 'GraphQL', 'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Figma', 'UI Design', 'UX Design', 'User Research', 'Product Design', 'Design Systems', 'Agile', 'Scrum', 'Project Management', 'Product Management', 'Data Analysis', 'Excel', 'Power BI', 'Tableau', 'Machine Learning', 'TensorFlow', 'PyTorch', 'SEO', 'Content Strategy', 'Copywriting', 'Sales', 'Customer Success', 'Communication', 'Leadership', 'Redis', 'Jest', 'Playwright', 'Cypress', 'CI/CD', 'Go', 'Rust', 'Swift', 'Kotlin', 'Flutter', 'React Native'];

export function extractSkills(text) {
  const unique = new Map();
  for (const skill of vocabulary) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text)) unique.set(normalizeSkill(skill), skill);
  }
  return [...unique.values()].slice(0, 50);
}
