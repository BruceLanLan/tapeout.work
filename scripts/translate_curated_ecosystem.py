#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "i18n" / "ecosystem"
LOCALES = {
    "ko": "Korean", "ja": "Japanese", "es": "neutral Spanish", "ar": "Modern Standard Arabic",
    "tr": "Turkish", "fr": "international neutral French", "de": "German", "ru": "international neutral Russian", "pt": "Brazilian Portuguese",
}
PROTECTED = "TapeOut, TapeOut Intelligence, $BEM, PoD, Canvas, Processor, Circuit, BNB, BNB Chain, BscScan, API, URL, Official, Community, Reference"


def export_seed():
    result = subprocess.run(
        ["node", "scripts/export_curated_ecosystem_seed.mjs"], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return json.loads(result.stdout)


def payload(seed):
    return {
        "updates": [{"id": x["id"], "title": x["title_en"], "summary": x["summary_en"], "source_note": x["source_note_en"]} for x in seed["updates"]],
        "tools": [{"id": x["id"], "title": x["title_en"], "summary": x["summary_en"], "safety": x["safety_en"]} for x in seed["tools"]],
    }


def schema(seed):
    update = {"type": "object", "properties": {"title": {"type": "string"}, "summary": {"type": "string"}, "source_note": {"type": "string"}}, "required": ["title", "summary", "source_note"], "additionalProperties": False}
    tool = {"type": "object", "properties": {"title": {"type": "string"}, "summary": {"type": "string"}, "safety": {"type": "string"}}, "required": ["title", "summary", "safety"], "additionalProperties": False}
    return {
        "type": "object",
        "properties": {
            "updates": {"type": "object", "properties": {x["id"]: update for x in seed["updates"]}, "required": [x["id"] for x in seed["updates"]], "additionalProperties": False},
            "tools": {"type": "object", "properties": {x["id"]: tool for x in seed["tools"]}, "required": [x["id"] for x in seed["tools"]], "additionalProperties": False},
        },
        "required": ["updates", "tools"],
        "additionalProperties": False,
    }


def translate(locale, language, seed):
    client = OpenAI()
    prompt = f"""Translate the approved TapeOut Intelligence display copy below into {language}. Return JSON only using the provided schema. Preserve these exact protocol/product terms unless grammar requires surrounding words: {PROTECTED}. Do not add claims, URLs, prices, investment advice, endorsements, tool capabilities, author details or safety promises. Keep Official/Community/Reference source boundaries and warnings explicit. 'source_note' and 'safety' must remain cautious and non-promotional. The external original URL is not translated, so never claim the external source exists in the target language.\n\nApproved English copy:\n{json.dumps(payload(seed), ensure_ascii=False)}"""
    response = None
    last_error = None
    for attempt in range(4):
        try:
            response = client.chat.completions.create(
                model="gpt-5-mini",
                messages=[
                    {"role": "system", "content": "You are a precise localization editor for a public crypto research catalog. Preserve factual and risk boundaries."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_schema", "json_schema": {"name": "ecosystem_localization", "strict": True, "schema": schema(seed)}},
                max_completion_tokens=7000,
            )
            break
        except Exception as error:
            last_error = error
            if attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))
    if response is None:
        raise last_error or RuntimeError("translation request failed")
    data = json.loads(response.choices[0].message.content)
    validate(seed, data, locale)
    return {"locale": locale, "source_catalog_version": seed["version"], "reviewed_at": seed["reviewed_at"], "translation_scope": "TapeOut Intelligence reviewed display copy only; source URL, author, original language, source tier and evidence fields remain canonical.", "translations": data}


def validate(seed, data, locale):
    for item in seed["updates"]:
        translated = data["updates"].get(item["id"], {})
        for key in ("title", "summary", "source_note"):
            value = translated.get(key, "")
            if not isinstance(value, str) or len(value.strip()) < 4 or len(value) > 900:
                raise ValueError(f"{locale} update {item['id']} invalid {key}")
    for item in seed["tools"]:
        translated = data["tools"].get(item["id"], {})
        for key in ("title", "summary", "safety"):
            value = translated.get(key, "")
            if not isinstance(value, str) or len(value.strip()) < 4 or len(value) > 900:
                raise ValueError(f"{locale} tool {item['id']} invalid {key}")


def main():
    seed = export_seed()
    OUT.mkdir(parents=True, exist_ok=True)
    results = {}
    force = '--force' in sys.argv
    selected = {code: name for code, name in LOCALES.items() if force or not (OUT / f'{code}.json').exists()}
    for code in LOCALES:
        if code not in selected:
            print(json.dumps({'locale': code, 'skipped': 'existing pack; use --force to regenerate'}, ensure_ascii=False))
    with ThreadPoolExecutor(max_workers=1) as executor:
        futures = {executor.submit(translate, code, name, seed): code for code, name in selected.items()}
        for future in as_completed(futures):
            locale = futures[future]
            results[locale] = future.result()
    for locale, body in results.items():
        target = OUT / f"{locale}.json"
        target.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
