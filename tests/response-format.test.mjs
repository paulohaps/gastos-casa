import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResponseBlocks } from '../js/core/response-format.mjs';
test('tabela conserva cabeçalhos, centavos textuais e linhas, sem recalcular a resposta',()=>{
 const blocks=parseResponseBlocks('| Categoria | Valor |\n| :--- | ---: |\n| Mercado | R$ 0,01 |\n| Contas | **R$ 180,50** |');
 assert.deepEqual(blocks,[{kind:'table',lines:[],header:['Categoria','Valor'],rows:[['Mercado','R$ 0,01'],['Contas','**R$ 180,50**']]}]);
});
test('tabela incompleta no streaming permanece texto e não perde a próxima linha',()=>{
 const blocks=parseResponseBlocks('| Categoria | Valor |\n| Mercado | R$ 10,00 |');
 assert.equal(blocks[0].kind,'paragraph');assert.match(blocks[0].lines.join('\n'),/Mercado/);
 const mixed=parseResponseBlocks('| Categoria | Valor |\n| --- | --- |\n| Mercado | R$ 10 |\n| Linha | ainda | incompleta |');
 assert.equal(mixed[0].rows.length,1);assert.equal(mixed[1].kind,'paragraph');assert.match(mixed[1].lines[0],/incompleta/);
});
test('HTML e URLs de modelo ficam como texto, sem interpretação nem execução',()=>{
 const attack='<img src=x onerror=alert(1)>';
 const blocks=parseResponseBlocks('| Item | Valor |\n| --- | --- |\n| '+attack+' | [abrir](javascript:alert(1)) |');
 assert.equal(blocks[0].rows[0][0],attack);assert.equal(blocks[0].rows[0][1],'[abrir](javascript:alert(1))');
});
test('pipe escapado permanece dentro da célula e CRLF é aceito',()=>{
 assert.deepEqual(parseResponseBlocks('Nome | Valor\r\n--- | ---\r\nCasa \\| Cofre | 12')[0].rows,[['Casa | Cofre','12']]);
});
test('títulos, listas e numeração original continuam estruturados entre tabelas',()=>{
 const blocks=parseResponseBlocks('# Resumo\n\n3. Primeiro\n4. Segundo\n\n- Rever\n- Conferir\n\nTexto final');
 assert.deepEqual(blocks.map(b=>b.kind),['heading','ol','ul','paragraph']);assert.equal(blocks[1].start,3);assert.equal(blocks[1].lines.length,2);
});
