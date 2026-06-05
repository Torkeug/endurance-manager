import re, os

found_files = []
for root, dirs, files in os.walk('app'):
    dirs[:] = [d for d in dirs if d not in ['.next', 'node_modules', 'admin', 'guide', 'api', 'auth']]
    for fname in files:
        if fname.endswith('.js'):
            found_files.append(os.path.join(root, fname).replace(os.sep, '/'))
for root, dirs, files in os.walk('components'):
    dirs[:] = [d for d in dirs if d not in ['.next', 'node_modules']]
    for fname in files:
        if fname.endswith('.js'):
            found_files.append(os.path.join(root, fname).replace(os.sep, '/'))
found_files = [f for f in found_files if 'admin' not in f and 'guide' not in f]

# Pattern 1: standalone text-only lines (JSX text nodes on their own line)
# These are lines with only indentation + plain text (no code syntax chars)
text_only = re.compile(r'^[ \t]+([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff ,\'\-\.!?:\/]{3,})[ \t]*$')
code_chars = re.compile(r'[.()=;:_\[\]{}&|><!]')
code_kw = re.compile(
    r'//|import |/\*|\*\s|const |let |var |return |function |async |export |'
    r'if \(|else |\.map\b|\.filter\b|&&|=>|\|\||new Date|String\(|Number\(|'
    r'supabase|iracing|garage61|await |throw |case |default:'
)

# Pattern 2: template literals containing accented French characters
# (not preceded by t( on the same line)
template_accent = re.compile(r'`[^`\n]*[\xc0-\xff]{1}[^`\n]*`')

# Pattern 3: JSX attributes with French-looking string values
attr_str = re.compile(r'(?:placeholder|title|aria-label|label|alt)=["\']([^"\']{6,})["\']')

found = []
for fpath in sorted(found_files):
    try:
        with open(fpath, encoding='utf-8') as fh:
            lines = fh.readlines()
        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
                continue

            # Test 1: standalone text node line
            m = text_only.match(line)
            if m:
                text = m.group(1).strip()
                if (len(text) > 6 and ' ' in text
                        and not code_chars.search(text)
                        and not code_kw.search(text)):
                    found.append((fpath, lineno, 'TEXT_NODE', text))

            # Test 2: template literal with accented chars
            for m2 in template_accent.finditer(line):
                text = m2.group(0)
                # Skip if it's inside a t() call
                before = line[:m2.start()]
                if 't(' in before[-20:]:
                    continue
                # Skip timezone/date format strings
                if any(s in text for s in ['Europe/', 'yyyy', 'HH:mm', 'EEEE', 'MMMM', 'filter=', 'eq.']):
                    continue
                if len(text) > 8:
                    found.append((fpath, lineno, 'TEMPLATE', text[:100]))

            # Test 3: attribute values that look like French text
            for m3 in attr_str.finditer(line):
                text = m3.group(1).strip()
                # Skip if already using t()
                if 't(' in line:
                    continue
                # Skip technical values
                if any(s in text for s in ['px', 'rem', '#', 'var(', 'url(', 'http', 'yyyy', 'HH']):
                    continue
                if len(text) > 6 and not text.replace(' ', '').isalnum() is False:
                    found.append((fpath, lineno, 'ATTR', text))

    except Exception as e:
        print(f'ERROR reading {fpath}: {e}')

for fpath, lineno, kind, text in found:
    print(f'{fpath}:{lineno} [{kind}] {repr(text)}')
print(f'\nTotal candidates: {len(found)}')
