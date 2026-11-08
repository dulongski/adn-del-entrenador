import json,os,re
D=os.path.dirname(os.path.abspath(__file__))
t=open(f'{D}/template.html').read()
t=t.replace("altura_defensiva:b=>`defiende a ${b.crudo} m de su arco <span class=\"mut\">· liga ${b.liga}</span>`","altura_defensiva:b=>`recupera a ${b.crudo} yd de su arco <span class=\"mut\">· liga ${b.liga}</span>`")
img=json.load(open(f'{D}/img.json')); data=open(f'{D}/data.json').read()
isac=open(os.path.expanduser('~/coach-dna-work/repo/web/src/assets/isac.svg')).read().strip()
pin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
ball=open(f'{D}/ball.svg').read()
qr=open(f'{D}/qr.svg').read().replace('class="segno"','class="segno" viewBox="0 0 370 370"')
t=t.replace('__QR__',qr).replace('__ISAC__',isac).replace('__PIN__',pin).replace('__BALL__',ball)
for k,v in img.items(): t=t.replace(f'__I_{k}__',v)
t=t.replace('__DATA__',data).replace('__IMGJS__',json.dumps(img))
left=set(re.findall(r'__[A-Z][A-Za-z_]*__',t)); assert not left, left
open(f'{D}/coach-dna-notas.html','w').write(t)  # versión local con notas del speaker (tecla N)
t=re.sub(r'<aside class="nt">.*?</aside>','',t,flags=re.S)  # la versión publicada va sin notas
t=t.replace('</style>','#nb,#notes{display:none!important}</style>',1)
open(f'{D}/coach-dna-final.html','w').write(t)
open('/private/tmp/cdna-dist/deck.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+t+'</body></html>')
print('ok',len(t))
