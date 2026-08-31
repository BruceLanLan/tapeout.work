#!/usr/bin/env python3
import json
import os
import time
from pathlib import Path
from urllib.request import Request, urlopen
from openai import OpenAI

MODEL = 'gpt-5-mini'
BASE = os.environ.get('LEARNING_CATALOG_BASE', 'https://tapeout-public-monitor.tapeout-labs.workers.dev').rstrip('/')
OUT = Path('public/i18n/learning')
LOCALES = {
    'ko': 'Korean (South Korea)',
    'ja': 'Japanese (Japan)',
    'es': 'Spanish (international neutral Spanish, suitable for Europe and Latin America)',
    'ar': 'Modern Standard Arabic (clear product Arabic; do not use dialect)',
    'tr': 'Turkish (Turkey)',
    'fr': 'French (international neutral French)',
    'de': 'German (Germany)',
    'ru': 'Russian (international neutral Russian)',
    'pt': 'Brazilian Portuguese (Brazil-first, understandable to Portuguese readers)',
}
client = OpenAI()

def call(system, user):
    error = None
    for attempt in range(4):
        try:
            return client.chat.completions.create(
                model=MODEL,
                messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
                response_format={'type': 'json_object'},
                max_completion_tokens=6000,
            ).choices[0].message.content
        except Exception as exc:
            error = exc
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise error

def main():
    request = Request(f'{BASE}/api/v1/learn/resources?page=1&page_size=24', headers={'User-Agent': 'TapeOut-Intelligence-i18n-audit/1.0', 'Accept': 'application/json'})
    try:
        with urlopen(request, timeout=40) as response:
            source = json.load(response)
    except Exception:
        fallback = Path('reports/2026-08-25/raw/learning.json')
        if not fallback.exists():
            raise
        source = json.loads(fallback.read_text(encoding='utf-8'))
    items = source['items']
    canonical = {item['id']: {'title': item['title_en'], 'summary': item['summary_en']} for item in items}
    OUT.mkdir(parents=True, exist_ok=True)
    force = '--force' in __import__('sys').argv
    for code, language in LOCALES.items():
        target = OUT / f'{code}.json'
        if target.exists() and not force:
            print(json.dumps({'locale': code, 'skipped': 'existing pack; use --force to regenerate'}, ensure_ascii=False))
            continue
        system = f'''You are a senior Web3 curriculum localization editor. Translate each TapeOut learning-resource title and summary to {language}.
Return JSON only in this exact form: {{"resource-id":{{"title":"...","summary":"..."}}}}.
Keep TapeOut, $BEM, PoD, Processor, Circuit, Canvas, NAND, LATCH, BNB Chain, ERC-1155, ERC-721, URL and contract names recognizable. Do not change factual claims, source tier, safety caveats, irreversibility, or risk boundaries. Never add investment advice, earnings promises, or unverifiable instructions. The original linked source may remain in a different language; you are translating the platform’s reviewed card copy, not claiming the source itself is translated.'''
        raw = call(system, json.dumps(canonical, ensure_ascii=False))
        translated = json.loads(raw)
        if set(translated) != set(canonical):
            raise RuntimeError(f'{code}: resource id mismatch')
        for resource_id, value in translated.items():
            if not isinstance(value, dict) or set(value) != {'title', 'summary'} or not all(isinstance(value[key], str) and value[key].strip() for key in value):
                raise RuntimeError(f'{code}: invalid translation for {resource_id}')
        payload = {
            'locale': code,
            'source_catalog_version': source.get('catalog_version'),
            'reviewed_at': source.get('reviewed_at'),
            'translations': translated,
        }
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps({'locale': code, 'resources': len(translated), 'file': str(target)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
