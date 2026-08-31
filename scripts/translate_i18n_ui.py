#!/usr/bin/env python3
import concurrent.futures
import json
import os
import re
import sys
import time
from pathlib import Path
from openai import OpenAI

SOURCE = Path('public/i18n/en.json')
OUTPUT_DIR = Path('public/i18n')
MODEL = 'gpt-5-mini'
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
CHUNK_SIZE = 42
PRESERVE = 'TapeOut, Processor, Circuit, Canvas, NAND, LATCH, $BEM, Proof of Design, PoD, BNB Chain, BSC, API, ERC-1155, ERC-721, URL, RPC, D1, Mint, Gas, BNB, USD, JSON, CSV, SHA-256, Q&A'
client = OpenAI()


def chunks(items):
    for i in range(0, len(items), CHUNK_SIZE):
        yield dict(items[i:i + CHUNK_SIZE])


def tokens(value):
    if not isinstance(value, str):
        return set()
    return set(re.findall(r'<[^>]+>|\{[^}]+\}|https?://\S+|\$BEM', value))


def translate_one(locale, language, index, payload):
    system = f'''You are a senior Web3 product localization editor. Translate UI strings from English to {language}.
Return only a JSON object with exactly the supplied keys and the same value types. Preserve empty objects unchanged.
Do not translate or change these protocol terms: {PRESERVE}.
Preserve HTML tags such as <br> and <em>, placeholder tokens such as {{range}}, {{days}}, {{start}}, {{end}}, URLs, numeric thresholds, arrows, and punctuation semantics.
Never introduce investment advice, return promises, wallet security claims beyond the source, or new facts. Use concise natural native UI language, and make safety warnings clear.'''
    last_error = None
    for attempt in range(4):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {'role': 'system', 'content': system},
                    {'role': 'user', 'content': json.dumps(payload, ensure_ascii=False)}
                ],
                response_format={'type': 'json_object'},
                max_completion_tokens=8000,
            )
            raw = response.choices[0].message.content
            break
        except Exception as exc:
            last_error = exc
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    else:
        raise last_error

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f'{locale} chunk {index}: invalid JSON: {raw[:300]}') from exc
    if set(result) != set(payload):
        raise RuntimeError(f'{locale} chunk {index}: key mismatch missing={set(payload)-set(result)} extra={set(result)-set(payload)}')
    for key, source_value in payload.items():
        value = result[key]
        if type(value) is not type(source_value):
            raise RuntimeError(f'{locale} chunk {index}: type mismatch for {key}')
        if isinstance(source_value, str):
            missing = tokens(source_value) - tokens(value)
            if missing:
                raise RuntimeError(f'{locale} chunk {index}: lost protected tokens for {key}: {sorted(missing)}')
    return index, result


def main():
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    items = list(source.items())
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    force = '--force' in sys.argv
    for locale, language in LOCALES.items():
        target = OUTPUT_DIR / f'{locale}.json'
        if target.exists() and not force:
            print(json.dumps({'locale': locale, 'skipped': 'existing pack; use --force to regenerate'}, ensure_ascii=False))
            continue
        tasks = list(enumerate(chunks(items)))
        translated = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(translate_one, locale, language, index, payload) for index, payload in tasks]
            for future in concurrent.futures.as_completed(futures):
                index, result = future.result()
                translated[index] = result
        merged = {}
        for index, _ in tasks:
            merged.update(translated[index])
        if list(merged) != list(source):
            raise RuntimeError(f'{locale}: ordering/key validation failed')
        target.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps({'locale': locale, 'keys': len(merged), 'file': str(target)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
