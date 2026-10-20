(function(root) {
  'use strict';
  function localDate(date = new Date()) {
    if (!Number.isFinite(date.getTime())) throw new Error('Data inválida.');
    return [String(date.getFullYear()).padStart(4,'0'),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function isoDate(value) {
    if (typeof value !== 'string') throw new Error('Data inválida.');
    const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(value) ? value.split('/').reverse().join('-') : value;
    const date = new Date(iso+'T12:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==iso) throw new Error('Data inválida.');
    return iso;
  }
  function comparisonPeriods(current,previous,month,today=localDate()) {
    if (!Array.isArray(current)||!Array.isArray(previous)||!/^(0[1-9]|1[0-2])\/\d{4}$/.test(month)) throw new Error('Período inválido.');
    today=isoDate(today);
    const selected=month.split('/').reverse().join('-'), cursor=new Date(selected+'-01T12:00:00Z');
    cursor.setUTCMonth(cursor.getUTCMonth()-1);
    const prior=cursor.toISOString().slice(0,7);
    for (const [rows,period] of [[current,selected],[previous,prior]]) for(const row of rows) if(isoDate(row.data).slice(0,7)!==period) throw new Error('Dados de outro mês.');
    if(selected>today.slice(0,7)) return {available:false,isCurrent:false,current:[],previous:[],currentThrough:null,previousThrough:null};
    const isCurrent=selected===today.slice(0,7), limit=isCurrent?Number(today.slice(8)):31;
    const through=period=>{ const date=new Date(period+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(0);return period+'-'+String(Math.min(limit,date.getUTCDate())).padStart(2,'0'); };
    const cut=rows=>rows.filter(row=>Number(isoDate(row.data).slice(8))<=limit);
    return {available:true,isCurrent,current:cut(current),previous:cut(previous),currentThrough:through(selected),previousThrough:through(prior)};
  }
  root.GastosCalendar=Object.freeze({localDate,isoDate,comparisonPeriods});
})(globalThis);
