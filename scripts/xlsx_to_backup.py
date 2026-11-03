"""Converts the last weekly sheets of the user's Excel workout log into a GymApp backup JSON.

Usage: python -I -X utf8 scripts/xlsx_to_backup.py <input.xlsx> <output.json> [first_sheet_number]
Only the standard library is used. IDs are deterministic (uuid5), so importing twice is idempotent.
"""
import json, re, sys, uuid, zipfile, html, datetime as dt

YEAR = 2026  # assumption: sheet names carry no year (see context/kararlar.md)
NS = uuid.UUID('6f1d5a3e-0a54-4c37-9a35-7b9d4a1c2e11')
DAYS_TR = {'pazartesi': 0, 'salı': 1, 'çarşamba': 2, 'perşembe': 3, 'cuma': 4, 'cumartesi': 5, 'pazar': 6}


# User-approved merges of differently written names for the same exercise.
NAME_MAP = {'LATERAL RISE': 'Lateral Raise DB', 'Lateral Raise (Cable/DB)': 'Lateral Raise DB'}


def uid(*parts):
    return str(uuid.uuid5(NS, '|'.join(str(p) for p in parts)))


def read_sheets(path):
    z = zipfile.ZipFile(path)
    wb = z.read('xl/workbook.xml').decode()
    names = [html.unescape(n) for n in re.findall(r'<sheet [^>]*name="([^"]*)"', wb)]
    ss = re.findall(r'<si>(.*?)</si>', z.read('xl/sharedStrings.xml').decode(), re.S)
    ss = [html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>', s, re.S))) for s in ss]
    sheets = []
    for i, name in enumerate(names, 1):
        x = z.read(f'xl/worksheets/sheet{i}.xml').decode()
        rows = {}
        for rn, body in re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', x, re.S):
            cells = {}
            for ref, attrs, cbody in re.findall(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', body, re.S):
                v = re.search(r'<v>(.*?)</v>', cbody or '')
                if v:
                    cells[ref] = ss[int(v.group(1))] if 't="s"' in attrs else v.group(1)
            rows[int(rn)] = cells
        sheets.append((name, rows))
    return sheets


def week_range(name):
    m = re.search(r'(\d{2})\.(\d{2})\s*-\s*(\d{2})\.(\d{2})', name)
    a = dt.date(YEAR, int(m.group(2)), int(m.group(1)))
    b = dt.date(YEAR, int(m.group(4)), int(m.group(3)))
    return a, b


def pick_date(a, b, weekday):
    d = a
    while d <= b:
        if d.weekday() == weekday:
            return d
        d += dt.timedelta(days=1)
    return None


SET_RE = re.compile(r'(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)', re.I)


def parse_sets(cell):
    sets, extra = [], []
    for tok in cell.split(','):
        tok = tok.strip()
        if not tok or tok == '0':
            continue
        m = SET_RE.match(tok)
        if not m:
            extra.append(tok)
            continue
        sets.append({'reps': float(m.group(1).replace(',', '.')), 'weight': float(m.group(2).replace(',', '.'))})
        rest = tok[m.end():].strip()
        if rest:
            extra.append(rest)
    for s in sets:
        for k in ('reps', 'weight'):
            if s[k] == int(s[k]):
                s[k] = int(s[k])
    return sets, extra


def clean_rir(v):
    if v is None:
        return None
    try:
        f = float(v)
        if f > 100:  # Excel turned "1-2" style text into a date serial; unrecoverable
            return None
        return str(int(f)) if f == int(f) else str(f)
    except ValueError:
        return v.strip() or None


def main(src, dst, first=49):
    sheets = read_sheets(src)[first - 1:]
    exercises, workouts, warnings = {}, [], []
    prev_sig = {}
    for name, rows in sheets:
        a, b = week_range(name)
        day_title = None
        entries = []
        has_form_col = False
        order = sorted(rows)
        for rn in order:
            c = rows[rn]
            a_val = c.get('A', '').strip()
            if re.match(r'\d+\.\s*GÜN', a_val):
                day_title = re.sub(r'^\d+\.\s*GÜN:\s*', '', a_val).split('\n')[0].strip()
                entries = []
                if rn == min(r for r in order if rows[r].get('A', '').strip().startswith('1.')):
                    note_header = c.get('F', '').strip().lower()
                    has_form_col = 'hareket' in note_header
                continue
            if a_val and not c.get('B') and not c.get('D'):
                wd = DAYS_TR.get(a_val.lower().replace('son', '').strip())
                if wd is None or day_title is None:
                    continue
                dates = [d for d in (a + dt.timedelta(days=i) for i in range((b - a).days + 1)) if d.weekday() == wd]
                date = dates[0]
                if len(dates) > 1:
                    warnings.append(f'{name}: "{a_val}" matches {len(dates)} dates in range, used {date}')
                sig = json.dumps([(e['_n'], e['sets']) for e in entries], sort_keys=True)
                key = day_title
                if prev_sig.get(key) == sig:
                    warnings.append(f'{name}: "{day_title}" ({date}) identical to the previous week -> skipped')
                else:
                    wid = uid('workout', name, day_title)
                    workouts.append({
                        'id': wid, 'date': date.isoformat(), 'title': day_title, 'comment': '',
                        'entries': [{k: v for k, v in e.items() if k != '_n'} for e in entries],
                        'createdAt': 0, 'updatedAt': 0,
                    })
                prev_sig[key] = sig
                day_title, entries = None, []
                continue
            if day_title and a_val and c.get('B') and c['B'] != 'Goal':
                ex_name = ' '.join(a_val.split())
                ex_name = NAME_MAP.get(ex_name, ex_name)
                ex = exercises.setdefault(ex_name, {'id': uid('exercise', ex_name), 'name': ex_name, 'formNote': '', 'createdAt': 0})
                note = c.get('F', '').strip() if has_form_col else ''
                if note:
                    ex['formNote'] = note  # later weeks overwrite: keeps the latest wording
                sets, extra = parse_sets(c.get('D', ''))
                comment_parts = []
                if c.get('E', '').strip():
                    comment_parts.append(c['E'].strip())
                if extra:
                    comment_parts.append('Set cell note: ' + '; '.join(extra))
                nxt = (c.get('G', '') if has_form_col else (c.get('F', '') or c.get('G', ''))).strip()
                if nxt and not nxt.lower().startswith('izle') and not nxt.lower().startswith('i̇zle'):
                    comment_parts.append('Next weight (planned): ' + nxt)
                goal = c['B'].strip()
                rir = clean_rir(c.get('C'))
                if rir is not None:
                    goal += f' (RIR {rir})'
                entries.append({
                    'id': uid('entry', name, day_title, ex_name), 'exerciseId': ex['id'], 'goal': goal,
                    'comment': ' | '.join(comment_parts), 'sets': sets, '_n': ex_name,
                })
    backup = {
        'app': 'GymApp', 'version': 1, 'exportedAt': dt.datetime.now().isoformat(),
        'exercises': list(exercises.values()), 'workouts': workouts, 'cardio': [], 'steps': [],
    }
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(backup, f, ensure_ascii=False, indent=1)
    print(f'{len(workouts)} workouts, {len(exercises)} exercises')
    for w in warnings:
        print('WARNING', w)
    print('Exercises:')
    for n in sorted(exercises):
        print('  ', n)
    for w in sorted(workouts, key=lambda w: w['date']):
        print(w['date'], w['title'], len(w['entries']), 'exercises')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 49)
