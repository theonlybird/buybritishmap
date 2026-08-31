"""Draft an outward-facing tier reason from an internal evidence_note.

evidence_note is written for Theo, deciding a tier. The update portal shows the
business its own reason, so it needs a version written for them: no references
to the grading process, no mapping notes, and the gap phrased as something they
can answer rather than a verdict they have to accept.

The draft is mechanical and is meant to be reviewed, not published unread.
build-note-review.py renders every draft beside its source for editing.
"""
import re

# Trailing clauses that only make sense to whoever was doing the grading.
INTERNAL = [
    r'\s*[—–-]\s*(Gold|Silver)\s+(on|under|by|pending)[^.;]*\.?',
    r'\s*[—–-]\s*(Gold|Silver)\s+pending[^.;]*\.?',
    r'\bso\s+(Gold|Silver)\b[^.;]*',
    r'\b(Gold|Silver)\s+on\s+the\s+[^.;]*precedent[^.;]*',
    r'\b(Gold|Silver)\s+under\s+(the\s+)?strict\s+rule[^.;]*',
    r'\b(Gold|Silver)\s+by\s+default\b[^.;]*',
    r'\b(Gold|Silver)\s+pending\s+confirmation\b[^.;]*',
    r'\s*County-level pin\.?',
    r'\s*Town-level pin\.?',
    r'\s*Pin(ned)?\s+(at|to)\s+[^.;]*\.?',
    r'\s*tier_confidence[^.;]*',
    r'\b(Gold|Silver):\s*',            # 'Silver: calf leather typically imported'
]

# The gap, in the business's own terms, keyed by what the note says is missing.
ASK = [
    (r'yarn.*(not|un)\s*evidenc|yarn origin|not evidenced as UK-spun|UK-spun',
     'clothing', 'Who spins your yarn, and where?'),
    (r'fabric.*(not|un)\s*(evidenc|stated|clear)|cloth.*(not|un)\s*(evidenc|stated)|not stated as UK-milled|UK-milled',
     'clothing', 'Which mill weaves or knits your main cloth?'),
    (r'leather.*(import|not|un)|tann',
     'clothing', 'Which tannery supplies your leather?'),
    (r'clay[- ]body|clay origin|clay.*(not|un)\s*(stated|evidenc|public)',
     'ceramics', 'Which clay body do you use, and who supplies or digs it?'),
    (r'casting|mount|chain.*(import|not)|principal component',
     'jewellery', 'Where are your castings or mounts made?'),
    (r'wine|coffee|deli|charcuterie|continental',
     'farm', 'What proportion of what you sell is your own or British produce — and where do the wine, coffee and deli lines come from?'),
    (r'stocks|imports|not\s+100|mostly British',
     'farm', 'What proportion of what you sell is your own or British produce?'),
    (r'steel|blade.*(import|not)',
     'cutlery', 'Where is your steel made?'),
]

# Keyed by the question that matched, so leather doesn't get told about weaving.
RULE_BY_ASK = {
 'Which tannery supplies your leather?': 'Gold needs the leather tanned in the UK.',
 'Where is your steel made?': 'Gold needs the steel made in the UK.',
}

# Every Silver record needs *a* question. Where nothing specific matched, fall
# back to the category's general one rather than leaving it blank for Theo.
FALLBACK_ASK = {
 'clothing':  'Where is your main fabric or material made?',
 'ceramics':  'Where does your clay body come from?',
 'jewellery': 'Where are your principal components made?',
 'farm':      'What proportion of what you sell is your own or British produce?',
 'cutlery':   'Where is your main material made?',
}

GOLD_RULE = {
 'clothing': 'Gold needs the main fabric milled, spun, woven or knitted in the UK.',
 'ceramics': 'Gold needs the clay body dug or prepared in the UK.',
 'jewellery': 'Gold needs the piece fabricated in the UK from bullion or grain.',
 'farm':     'Gold needs the shop to be effectively all British produce.',
 'cutlery':  'Gold needs the main material made in the UK.',
}


def strip_internal(note):
    out = note
    for pat in INTERNAL:
        out = re.sub(pat, '', out, flags=re.I)
    out = re.sub(r'\s{2,}', ' ', out)
    out = re.sub(r'\s+([.,;])', r'\1', out)
    out = out.strip(' ;,—–-')
    if out and not out.endswith('.'):
        out += '.'
    return out


def split_found_gap(note):
    """Most notes read '<what they do>, but <what is missing>'."""
    m = re.split(r',?\s+(?:but|however|although|though)\s+', note, maxsplit=1, flags=re.I)
    if len(m) == 2:
        return m[0].strip(' ,;'), m[1].strip(' ,;')
    m = re.split(r'\s*[—–]\s*', note, maxsplit=1)
    if len(m) == 2 and re.search(r'not|un|pending|missing', m[1], re.I):
        return m[0].strip(' ,;'), m[1].strip(' ,;')
    return note.strip(' ,;'), ''


def ask_for(note, category):
    for pat, cat, q in ASK:
        if cat == category and re.search(pat, note, re.I):
            return q
    return ''


def ask_or_fallback(note, category):
    return ask_for(note, category) or FALLBACK_ASK.get(category, '')


def draft(record):
    note = record.get('evidence_note', '') or ''
    tier = record.get('tier', '')
    cat = record.get('category', '')
    clean = strip_internal(note)
    found, gap = split_found_gap(clean)

    flags = []
    if tier == 'silver' and not gap:
        flags.append('no gap found — say what is missing')
    if tier == 'silver' and not ask_for(note, cat):
        flags.append('general question for the category — check it fits')
    if len(clean) > 320:
        flags.append('long')
    if re.search(r'\b(Gold|Silver)\b', clean, re.I):
        flags.append('still mentions a tier')
    if re.search(r'precedent|confidence|pin\b|batch|TODO|check', clean, re.I):
        flags.append('may still contain a working note')
    if not clean:
        flags.append('empty after cleaning')

    if tier == 'silver' and gap:
        gap_s = gap[0].lower() + gap[1:] if gap else gap
        gap_s = re.sub(r'^(the\s+)?(yarn|fabric|cloth|clay[- ]body|clay)\s+is\s+not\s+evidenced\s+as\s+',
                       lambda m: "we couldn't find evidence that the %s is " % m.group(2), gap_s, flags=re.I)
        gap_s = re.sub(r'\bnot\s+(publicly\s+)?(evidenced|stated|confirmed|clear)\b',
                       "not something we could confirm", gap_s, flags=re.I)
        q = ask_or_fallback(note, cat)
        rule = RULE_BY_ASK.get(q) or GOLD_RULE.get(cat, '')
        public = '%s — but %s. %s' % (found.rstrip('.'), gap_s.rstrip('.'), rule)
    else:
        public = clean

    public = re.sub(r'\s*,\s*\.', '.', public)
    public = re.sub(r'\s*;\s*\.', '.', public)
    public = re.sub(r'\.\s*\.+', '.', public)
    public = re.sub(r'\s+([.,;])', r'\1', public)

    return {
        'public': re.sub(r'\s{2,}', ' ', public).strip(),
        'ask': ask_or_fallback(note, cat) if tier == 'silver' else '',
        'flags': flags,
    }
