import { parentPort, workerData } from 'node:worker_threads';

try {
  const buffer = Buffer.from(workerData.buffer);
  let text;
  if (workerData.format === 'pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false });
    try { text = (await parser.getText({ first: 20 })).text; }
    finally { await parser.destroy(); }
  } else {
    const mammoth = (await import('mammoth')).default;
    text = (await mammoth.extractRawText({ buffer })).value;
  }
  parentPort.postMessage({ text: text.slice(0, 100000) });
} catch {
  parentPort.postMessage({ error: 'The resume could not be parsed. Upload a readable, unencrypted PDF or DOCX.' });
}
