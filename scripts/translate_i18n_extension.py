#!/usr/bin/env python3
import json
import time
from pathlib import Path
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/i18n/en.json'
TARGETS = {'ko': 'Korean (South Korea)', 'ja': 'Japanese (Japan)', 'es': 'neutral Spanish suitable for Europe and Latin America', 'ar': 'Modern Standard Arabic'}
PRESERVE = 'TapeOut, TapeOut Intelligence, Processor, Circuit, Canvas, NAND, LATCH, $BEM, Proof of Design, PoD, BNB Chain, BscScan, API, URL, X'


def translate(locale, language, payload):
    client = OpenAI()
    messages = [
        {'role': 'system', 'content': f'You are a precise Web3 UI localization editor. Translate into {language}. Return JSON with exactly the requested keys. Preserve the exact terms {PRESERVE}. Preserve arrows, punctuation meaning, safety boundaries and non-promotional tone. Do not add investment advice, factual claims, tool capabilities or source authority.'},
        {'role': 'user', 'content': json.dumps(payload, ensure_ascii=False)}
    ]
    error = None
    for attempt in range(4):
        try:
            response = client.chat.completions.create(model='gpt-5-mini', messages=messages, response_format={'type': 'json_object'}, max_completion_tokens=3000)
            result = json.loads(response.choices[0].message.content)
            if set(result) != set(payload) or not all(isinstance(result[key], str) and result[key].strip() for key in payload):
                raise RuntimeError('response keys or value types are invalid')
            return result
        except Exception as exc:
            error = exc
            if attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))
    raise error or RuntimeError('translation failed')


def main():
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    for locale, language in TARGETS.items():
        path = ROOT / f'public/i18n/{locale}.json'
        target = json.loads(path.read_text(encoding='utf-8'))
        payload = {key: value for key, value in source.items() if key not in target}
        if payload:
            target.update(translate(locale, language, payload))
            path.write_text(json.dumps(target, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        if set(target) != set(source):
            raise RuntimeError(f'{locale}: language pack keys do not match source')
        print(json.dumps({'locale': locale, 'added': len(payload), 'keys': len(target)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
