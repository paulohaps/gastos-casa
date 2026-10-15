/** A text-only Markdown subset. Cells are strings, never executable HTML. */
function cells(line) {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0,-1);
  return text.split(/(?<!\\)\|/).map(value => value.replace(/\\\|/g,'|').trim());
}
export function parseResponseBlocks(content) {
  const lines = content.replace(/\r\n?/g,'\n').split('\n'), blocks = [];
  let current;
  for (let index=0;index<lines.length;index++) {
    const line=lines[index];
    if (!line.trim()) {current=undefined;continue;}
    const header=cells(line), separator=cells(lines[index+1] || '');
    if (line.includes('|') && header.length>1 && header.length===separator.length && separator.every(cell=>/^:?-{3,}:?$/.test(cell))) {
      const rows=[];index++;
      while(index+1<lines.length && lines[index+1].includes('|')) {
        const next=cells(lines[index+1]);
        if(next.length!==header.length) break;
        rows.push(next);index++;
      }
      blocks.push({kind:'table',lines:[],header,rows});current=undefined;continue;
    }
    const heading=/^#{1,3}\s+(.+)$/.exec(line), bullet=/^\s*[-*]\s+(.+)$/.exec(line), ordered=/^\s*(\d{1,3})[.)]\s+(.+)$/.exec(line);
    const kind=heading?'heading':bullet?'ul':ordered?'ol':'paragraph';
    if(!current||current.kind!==kind||kind==='heading'||(ordered&&Number(ordered[1])!==(current.start??1)+current.lines.length)) {
      current={kind,lines:[],...(ordered?{start:Number(ordered[1])}:{})};blocks.push(current);
    }
    current.lines.push(heading?.[1]??bullet?.[1]??ordered?.[2]??line);
  }
  return blocks;
}
