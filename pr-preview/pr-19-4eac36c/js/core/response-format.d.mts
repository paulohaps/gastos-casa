export type ResponseBlock = {kind:"paragraph"|"heading"|"ul"|"ol";lines:string[];start?:number}|{kind:"table";lines:string[];header:string[];rows:string[][]};
export function parseResponseBlocks(content:string):ResponseBlock[];
