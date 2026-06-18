#!/usr/bin/env python3
import sys
import csv
import re

def normalize_number(s):
    if s is None:
        return ''
    t = str(s).replace('\u00A0', '').replace(' ', '')
    if '.' in t and ',' in t:
        t = t.replace('.', '').replace(',', '.')
    else:
        t = t.replace('.', '').replace(',', '.')
    t = re.sub(r'[^0-9.\-]', '', t)
    return t

def parse_month(raw):
    if not raw:
        return ''
    m = re.match(r"(\d{2})[\/-](\d{2})[\/-](\d{4})", raw)
    if m:
        return f"{m.group(3)}-{m.group(2)}"
    m2 = re.match(r"(\d{4})-(\d{2})", raw)
    if m2:
        return f"{m2.group(1)}-{m2.group(2)}"
    return raw

def main(path):
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        print('Headers:', reader.fieldnames)
        rows = list(reader)

    print('Total rows:', len(rows))
    setores = set()
    meses = set()
    atendentes = set()
    sum_finalizados = {}
    score_sum = 0.0
    score_count = 0
    score_missing = 0

    for r in rows:
        setores.add(r.get('Setor  🖥️') or r.get('Setor') or r.get('Setor ' ) or r.get('Setor'))
        mes = r.get('Mês') or r.get('Mes') or r.get('Mês ')
        mes_norm = parse_month(mes)
        meses.add(mes_norm)
        atend = r.get('Atendente 🙋') or r.get('Atendente') or r.get('Atendente ')
        atendentes.add(atend)

        # finalizados
        fval = r.get('Finalizados') or r.get('Finalizados ' ) or r.get('Finalizado')
        fn = normalize_number(fval)
        try:
            fnn = int(float(fn)) if fn!='' else None
        except:
            fnn = None
        if fnn is not None:
            sum_finalizados[atend] = sum_finalizados.get(atend, 0) + fnn

        # score
        sval = r.get('SCORE') or r.get('SCORE ' ) or r.get('Score')
        sn = normalize_number(sval)
        try:
            sfn = float(sn)
            score_sum += sfn
            score_count += 1
        except:
            score_missing += 1

    print('Unique setores:', len([s for s in setores if s]))
    print('Unique meses:', len([m for m in meses if m]))
    print('Unique atendentes:', len([a for a in atendentes if a]))
    top = sorted(sum_finalizados.items(), key=lambda x: x[1], reverse=True)[:10]
    print('Top atendentes por Finalizados (top 10):')
    for k,v in top:
        print(f'  {k}: {v}')
    if score_count>0:
        print(f'Average SCORE: {score_sum/score_count:.2f} (parsed {score_count} rows, missing {score_missing})')
    else:
        print('No SCORE values parsed')

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Usage: validate_csv.py path/to/file.csv')
        sys.exit(1)
    main(sys.argv[1])
